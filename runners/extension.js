/**
 * ideogram4-storybook — extension runner (Node.js / VS Code extension host).
 *
 * story_splitter : pure JS transform — splits story text into scenes.
 * storybook_pdf  : generates one AI image per scene, embeds image + text per
 *                  page (real kids-book layout). Uses pdf-lib + callTool +
 *                  callAgent injected by the extension graph-runner.
 *
 * Community blocks installed at ~/.salilvnair/ck8t/blocks/.
 * Dispatched via customBlockRunners.get(blockType) in the default case.
 */
'use strict'

/* ── story_splitter ── */

function runStorySplitter({ values, input }) {
  let text = ''
  if (typeof input === 'string') {
    text = input
  } else if (input && typeof input === 'object') {
    text = String(input.text ?? input.content ?? input.story ?? input.body ?? JSON.stringify(input, null, 2))
  }

  const splitBy        = String(values.split_by || 'scene')
  const delimiter      = String(values.delimiter || '\n\n---\n\n')
  const includeHeading = values.include_heading === true
  const maxScenes      = Math.max(0, parseInt(String(values.max_scenes || '0'), 10) || 0)

  let scenes = []

  if (splitBy === 'chapter' || splitBy === 'scene') {
    const depth  = splitBy === 'chapter' ? 1 : 2
    const prefix = '#'.repeat(depth)
    const headRe = new RegExp(`^${prefix}(?!#)\\s+(.+)$`)
    const lines  = text.split('\n')
    let currentTitle = null
    let currentLines = []

    const flush = () => {
      if (currentTitle === null) return
      const content = currentLines.join('\n').trim()
      if (content) scenes.push({ title: currentTitle, content })
    }

    for (const line of lines) {
      const m = line.match(headRe)
      if (m) {
        flush()
        currentTitle = m[1].trim()
        currentLines = includeHeading ? [line] : []
      } else {
        currentLines.push(line)
      }
    }
    flush()

  } else if (splitBy === 'paragraph') {
    scenes = text.split(/\n{2,}/)
      .map((p) => p.trim()).filter(Boolean)
      .map((content, i) => ({ title: `Scene ${i + 1}`, content }))
  } else {
    scenes = text.split(delimiter)
      .map((p) => p.trim()).filter(Boolean)
      .map((content, i) => ({ title: `Scene ${i + 1}`, content }))
  }

  if (maxScenes > 0) scenes = scenes.slice(0, maxScenes)
  const indexed = scenes.map((s, i) => ({ index: i + 1, ...s }))
  return { scenes: indexed, count: indexed.length, first: indexed[0] ?? null, last: indexed[indexed.length - 1] ?? null }
}

/* ── storybook_pdf ── */

async function runStorybookPdf({ values, input, inputsByHandle, callTool, callAgent }) {
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
  const fs   = require('node:fs')
  const path = require('node:path')
  const os   = require('node:os')

  // ── Resolve scenes array ───────────────────────────────────────────────────
  let scenes = []
  if (Array.isArray(input)) {
    scenes = input
  } else if (input && typeof input === 'object') {
    scenes = Array.isArray(input.scenes) ? input.scenes
           : Array.isArray(input.items)  ? input.items
           : []
  }

  // ── Config ─────────────────────────────────────────────────────────────────
  const docTitle  = String(values.title  || 'Storybook')
  const docAuthor = String(values.author || '')
  const pageSz    = String(values.page_size || 'A4')
  const layout    = String(values.layout || 'title_scenes')
  const fsHead    = Math.max(8, parseFloat(String(values.font_size_heading || '18')))
  const fsBody    = Math.max(6, parseFloat(String(values.font_size_body   || '11')))
  const pageNums  = values.include_page_numbers !== false
  const outPath   = values.output_path ? String(values.output_path) : null
  const mcpServer = values.mcp_server ? String(values.mcp_server) : null
  const genImages = values.generate_scene_images !== false && !!mcpServer
  const artStyle  = String(values.art_style || "Indian 90s children's book illustration, warm colours, flat style, expressive animal faces, neighbourhood rooftops")
  const imgModel  = String(values.image_model || 'gpt-4.1')

  const SIZES = { A4: [595.28, 841.89], Letter: [612, 792], A5: [419.53, 595.28], Square: [600, 600] }
  const [W, H] = SIZES[pageSz] || SIZES.A4
  const MARGIN = 50

  // ── PDF setup ──────────────────────────────────────────────────────────────
  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(docTitle)
  if (docAuthor) pdfDoc.setAuthor(docAuthor)
  pdfDoc.setCreator('CK8T ideogram4-storybook')

  const fontHead = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontBody = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const ink      = rgb(0.10, 0.10, 0.10)
  const muted    = rgb(0.50, 0.50, 0.50)
  const accent   = rgb(0.49, 0.23, 0.86)

  const drawWrapped = (page, txt, { x, y, maxW, font, size, color, lh }) => {
    const words = String(txt).split(/\s+/)
    let line = ''; let cy = y
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(test, size) > maxW && line) {
        page.drawText(line, { x, y: cy, font, size, color }); cy -= lh; line = word
      } else { line = test }
    }
    if (line) { page.drawText(line, { x, y: cy, font, size, color }); cy -= lh }
    return cy
  }

  // ── Title page ─────────────────────────────────────────────────────────────
  if (layout === 'title_scenes') {
    const tp = pdfDoc.addPage([W, H])

    // Optional cover image from in_cover port (backward-compatible)
    const coverPort = inputsByHandle && inputsByHandle['cover']
    const coverB64  = coverPort && typeof coverPort.cover_base64 === 'string' ? coverPort.cover_base64 : null
    let textBaseY = H / 2 + 60

    if (coverB64) {
      try {
        const imgBytes    = Buffer.from(coverB64, 'base64')
        const embeddedImg = await pdfDoc.embedPng(imgBytes)
        const maxImgW     = W - MARGIN * 2
        const maxImgH     = H / 2 - MARGIN - 20
        const dims        = embeddedImg.scaleToFit(maxImgW, maxImgH)
        tp.drawImage(embeddedImg, {
          x: MARGIN + (maxImgW - dims.width) / 2,
          y: H - MARGIN - dims.height,
          width: dims.width, height: dims.height,
        })
        textBaseY = H - MARGIN - dims.height - 40
      } catch (_e) { /* text-only fallback */ }
    }

    tp.drawRectangle({ x: MARGIN, y: textBaseY - 10, width: W - MARGIN * 2, height: 3, color: accent })
    tp.drawText(docTitle.toUpperCase(), { x: MARGIN, y: textBaseY + 20, font: fontHead, size: fsHead + 8, color: ink })
    if (docAuthor) tp.drawText(`by ${docAuthor}`, { x: MARGIN, y: textBaseY - 30, font: fontBody, size: fsBody + 2, color: muted })
    tp.drawText(`${scenes.length} scene${scenes.length !== 1 ? 's' : ''}`, { x: MARGIN, y: MARGIN, font: fontBody, size: fsBody - 1, color: muted })
  }

  // ── Art director system prompt ─────────────────────────────────────────────
  const ART_SYSTEM = `You are a visual art director for a children's storybook. Style: ${artStyle}. Given a scene title and prose, write a vivid image prompt. Focus on composition, warm light, character personality, and sense of place. Return ONLY valid JSON.`

  // ── Per-scene pages ────────────────────────────────────────────────────────
  for (let i = 0; i < scenes.length; i++) {
    const scene   = scenes[i]
    const title   = String(scene.title || `Scene ${i + 1}`)
    const content = String(scene.content ?? scene.text ?? scene.body ?? '')
    const page    = pdfDoc.addPage([W, H])
    const maxW    = W - MARGIN * 2

    // ── Generate scene image ───────────────────────────────────────────────
    let sceneB64 = null

    if (genImages && mcpServer && typeof callAgent === 'function' && typeof callTool === 'function') {
      try {
        // 1. Art director agent → structured image prompt
        const artRes = await callAgent({
          agent: {
            id: `scene_art_${i}`,
            model: imgModel,
            temperature: 0.7,
            systemPrompt: ART_SYSTEM,
            userPrompt: `Title: ${title}\n\nContent:\n${content.slice(0, 600)}\n\nReturn JSON with "prompt" (string, under 80 words) and "aspect_ratio" ("1:1").`,
            responseFormat: '{"type":"object","properties":{"prompt":{"type":"string"},"aspect_ratio":{"type":"string"}},"required":["prompt","aspect_ratio"]}',
            strictOutput: false,
          },
          input: content,
        })

        let promptStr = ''
        const rawOut = artRes && artRes.output != null ? String(artRes.output) : ''
        try { promptStr = JSON.parse(rawOut).prompt || rawOut } catch { promptStr = rawOut }

        if (promptStr) {
          // 2. Magic prompt enhancement
          const magicRaw  = await callTool(mcpServer, 'magic_prompt', { prompt: promptStr })
          const magicText = _flattenMcpContent(magicRaw)

          // 3. Generate image
          const imgRaw  = await callTool(mcpServer, 'generate_image', { caption_json: magicText || promptStr })
          const imgText = _flattenMcpContent(imgRaw)

          // 4. Extract base64 PNG
          const m = imgText.match(/!\[.*?\]\(data:image\/png;base64,([A-Za-z0-9+\/=\n]+)\)/)
          if (m) sceneB64 = m[1].replace(/\n/g, '')
        }
      } catch (_err) {
        // Image generation failed for this scene — render text-only page
      }
    }

    // ── Draw page: image on top, title + text below ────────────────────────
    let y = H - MARGIN

    if (sceneB64) {
      try {
        const imgBytes    = Buffer.from(sceneB64, 'base64')
        const embeddedImg = await pdfDoc.embedPng(imgBytes)
        const maxImgH     = Math.floor((H - MARGIN * 2) * 0.42)
        const dims        = embeddedImg.scaleToFit(maxW, maxImgH)
        page.drawImage(embeddedImg, {
          x: MARGIN + (maxW - dims.width) / 2,
          y: H - MARGIN - dims.height,
          width: dims.width, height: dims.height,
        })
        y = H - MARGIN - dims.height - 16
      } catch (_e) { /* fall through to text-only */ }
    }

    // Scene number
    page.drawText(String(i + 1), { x: MARGIN, y, font: fontHead, size: fsBody - 1, color: accent })
    y -= fsHead + 8

    // Scene title
    y = drawWrapped(page, title, { x: MARGIN, y, maxW, font: fontHead, size: fsHead, color: ink, lh: fsHead * 1.3 })
    y -= 12
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 40, y }, thickness: 2, color: accent })
    y -= 20

    // Body text
    for (const para of content.split(/\n{2,}/)) {
      if (y < MARGIN + 40) break
      y = drawWrapped(page, para.trim(), { x: MARGIN, y, maxW, font: fontBody, size: fsBody, color: ink, lh: fsBody * 1.6 })
      y -= fsBody * 0.8
    }

    if (pageNums) {
      page.drawText(String(pdfDoc.getPageCount()), { x: W / 2 - 5, y: MARGIN / 2, font: fontBody, size: fsBody - 1, color: muted })
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  const pdfBytes  = await pdfDoc.save()
  const pageCount = pdfDoc.getPageCount()

  if (outPath) {
    const resolved = outPath.startsWith('~') ? outPath.replace('~', os.homedir()) : path.resolve(outPath)
    fs.mkdirSync(path.dirname(resolved), { recursive: true })
    fs.writeFileSync(resolved, pdfBytes)
    return { path: resolved, pages: pageCount, size_bytes: pdfBytes.length }
  }
  return { pages: pageCount, size_bytes: pdfBytes.length, pdf_base64: Buffer.from(pdfBytes).toString('base64') }
}

/** Flatten MCP content array → plain string. */
function _flattenMcpContent(raw) {
  const items = Array.isArray(raw) ? raw : [raw]
  return items.map(c => (c && typeof c === 'object') ? (c.text || '') : String(c || '')).join('')
}

/* ── Export ── */

module.exports = [
  {
    type: 'story_splitter',
    run({ values, input }) { return runStorySplitter({ values, input }) },
  },
  {
    type: 'storybook_pdf',
    async run({ values, input, inputsByHandle, callTool, callAgent }) {
      return runStorybookPdf({ values, input, inputsByHandle, callTool, callAgent })
    },
  },
]
