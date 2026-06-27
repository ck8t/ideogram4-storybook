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

function runStorySplitter({ values, input, progress }) {
  let text = ''
  if (typeof input === 'string') {
    text = input
  } else if (input && typeof input === 'object') {
    text = String(input.text ?? input.content ?? input.story ?? input.body ?? JSON.stringify(input, null, 2))
  }

  progress?.({ pct: 10, step: 1, total: 3, label: 'Parsing text...' })

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

  progress?.({ pct: 70, step: 2, total: 3, label: `Indexing ${scenes.length} scenes...` })

  const indexed = scenes.map((s, i) => ({ index: i + 1, ...s }))

  progress?.({ pct: 100, step: 3, total: 3, label: `${indexed.length} scenes ready` })

  return { scenes: indexed, count: indexed.length, first: indexed[0] ?? null, last: indexed[indexed.length - 1] ?? null }
}

/* ── storybook_pdf ── */

/** Sanitize text for pdf-lib's WinAnsi (Latin-1) Helvetica fonts.
 *  Converts common unicode typographic chars → ASCII equivalents,
 *  then strips any remaining non-Latin-1 codepoints. */
function pdfText(str) {
  return String(str ?? '')
    .replace(/[‘’ʼ′]/g, "'")   // curly single quotes / prime
    .replace(/[“”″]/g, '"')          // curly double quotes
    .replace(/…/g, '...')                       // horizontal ellipsis
    .replace(/—/g, '--')                        // em dash
    .replace(/–/g, '-')                         // en dash
    .replace(/[   ]/g, ' ')           // non-breaking / narrow spaces
    .replace(/[•‣◦]/g, '*')           // bullet variants
    .replace(/[✓✔]/g, 'v')                 // checkmarks
    .replace(/[^\x00-\xFF]/g, '?')                   // anything else outside Latin-1
}

async function runStorybookPdf({ values, input, inputsByHandle, callTool, callAgent, progress }) {
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
  const fs   = require('node:fs')
  const path = require('node:path')
  const os   = require('node:os')

  // ── Resolve scenes array ───────────────────────────────────────────────────
  // When multiple ports are wired, graph-runner sets `input` = array of all
  // upstream values. Use inputsByHandle.input (the in_input port) when
  // available to get only the scenes, not the merged multi-input array.
  const scenesRaw = (inputsByHandle && inputsByHandle.input != null)
    ? inputsByHandle.input
    : input
  let scenes = []
  if (Array.isArray(scenesRaw)) {
    scenes = scenesRaw
  } else if (scenesRaw && typeof scenesRaw === 'object') {
    scenes = Array.isArray(scenesRaw.scenes) ? scenesRaw.scenes
           : Array.isArray(scenesRaw.items)  ? scenesRaw.items
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
  const mcpServer         = values.mcp_server ? String(values.mcp_server) : null
  const magicPromptServer = values.magic_prompt_mcp_server ? String(values.magic_prompt_mcp_server) : null
  const artStyle          = String(values.art_style || "Indian 90s children's book illustration, warm colours, flat style, expressive animal faces, neighbourhood rooftops")
  const imgModel          = String(values.image_model || 'gpt-4.1')

  // ── External images from the "images" port (skips built-in MCP generation) ─
  // Preferred decoupled design: caller generates images externally and passes them here.
  const externalImages = (inputsByHandle && Array.isArray(inputsByHandle['images']) && inputsByHandle['images'].length > 0)
    ? inputsByHandle['images']
    : null
  // Built-in MCP generation only runs when no external images are supplied.
  const genImages = !externalImages && values.generate_scene_images === true && !!mcpServer

  const SIZES = { A4: [595.28, 841.89], Letter: [612, 792], A5: [419.53, 595.28], Square: [600, 600] }
  const [W, H] = SIZES[pageSz] || SIZES.A4
  const MARGIN = 50

  // ── PDF setup ──────────────────────────────────────────────────────────────
  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(docTitle)
  if (docAuthor) pdfDoc.setAuthor(docAuthor)
  pdfDoc.setCreator('CK8T ideogram4-storybook')

  progress?.({ pct: 5, step: 1, total: scenes.length + 2, label: 'Setting up PDF...' })

  const fontHead = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontBody = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const ink      = rgb(0.10, 0.10, 0.10)
  const muted    = rgb(0.50, 0.50, 0.50)
  const accent   = rgb(0.49, 0.23, 0.86)

  const drawWrapped = (page, txt, { x, y, maxW, font, size, color, lh }) => {
    const words = pdfText(txt).split(/\s+/)
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

    // Optional cover image from the "cover" port.
    // Accepts: raw base64 string, MCP content array (markdown image), or {cover_base64}.
    const coverPort = inputsByHandle && inputsByHandle['cover']
    let coverB64 = null
    if (coverPort) {
      try { coverB64 = await _resolveCoverBase64(coverPort) } catch (_e) { /* text-only fallback */ }
    }
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
    tp.drawText(pdfText(docTitle).toUpperCase(), { x: MARGIN, y: textBaseY + 20, font: fontHead, size: fsHead + 8, color: ink })
    if (docAuthor) tp.drawText(pdfText(`by ${docAuthor}`), { x: MARGIN, y: textBaseY - 30, font: fontBody, size: fsBody + 2, color: muted })
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

    const scenePct = Math.round(10 + ((i / scenes.length) * 80))
    progress?.({ pct: scenePct, step: i + 2, total: scenes.length + 2, label: `Scene ${i + 1} / ${scenes.length}: ${title}` })

    // ── Resolve scene image ────────────────────────────────────────────────
    let sceneB64 = null

    if (externalImages) {
      // Use pre-generated image from the "images" port (decoupled design).
      // Supports: base64 strings, markdown images, Ideogram URL responses, and plain URLs.
      const raw = externalImages[i]
      if (raw != null) {
        try { sceneB64 = await _resolveSceneImageBase64(raw) } catch (_e) { /* skip image for this scene */ }
      }
    } else if (genImages && mcpServer && typeof callAgent === 'function' && typeof callTool === 'function') {
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
          // 2. magic_prompt enhancement — uses dedicated server if configured, skipped if blank
          let finalPrompt = promptStr
          if (magicPromptServer) {
            const magicRaw = await callTool(magicPromptServer, 'magic_prompt', { prompt: promptStr })
            finalPrompt    = _flattenMcpContent(magicRaw) || promptStr
          }

          // 3. Generate image
          const imgRaw  = await callTool(mcpServer, 'generate_image', { caption_json: finalPrompt })
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

    // Body text — strip SAYS:/THINKS: metadata lines (used for image prompts only)
    const narrativeLines = content.split('\n')
      .filter(l => !/^\s*(SAYS|THINKS)\s*:/i.test(l))
      .join('\n')
    for (const para of narrativeLines.split(/\n{2,}/)) {
      if (y < MARGIN + 40) break
      const paraText = para.trim()
      if (!paraText) continue
      y = drawWrapped(page, paraText, { x: MARGIN, y, maxW, font: fontBody, size: fsBody, color: ink, lh: fsBody * 1.6 })
      y -= fsBody * 0.8
    }

    if (pageNums) {
      page.drawText(String(pdfDoc.getPageCount()), { x: W / 2 - 5, y: MARGIN / 2, font: fontBody, size: fsBody - 1, color: muted })
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  progress?.({ pct: 95, step: scenes.length + 2, total: scenes.length + 2, label: 'Saving PDF...' })

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

/**
 * Download an image URL and return its bytes as a base64 string.
 * Works for http and https. Follows up to 5 redirects.
 */
function _downloadImageToBase64(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    if (!url || typeof url !== 'string') return reject(new Error('Invalid URL'))
    const mod = url.startsWith('https://') ? require('node:https') : require('node:http')
    mod.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
        return resolve(_downloadImageToBase64(res.headers.location, redirectsLeft - 1))
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} downloading image`))
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('base64')))
      res.on('error', reject)
    }).on('error', reject)
  })
}

/**
 * Extract an image URL from an Ideogram 4.0 API response object.
 * Ideogram returns: { data: [{ url, prompt, resolution, ... }], response_type: "url" }
 */
function _extractIdeogramUrl(obj) {
  if (!obj || typeof obj !== 'object') return null
  if (Array.isArray(obj.data) && obj.data.length > 0 && typeof obj.data[0].url === 'string') {
    return obj.data[0].url
  }
  return null
}

/**
 * Resolve a cover port value to a base64 PNG/JPEG string.
 * Handles:
 *   - raw base64 string
 *   - markdown image: ![...](data:image/...;base64,<b64>)
 *   - Ideogram response JSON: { data: [{ url }] }
 *   - plain https?:// URL string
 *   - { cover_base64: string }
 *   - MCP content array
 */
async function _resolveCoverBase64(coverPort) {
  if (!coverPort) return null

  // Ideogram API response object
  const ideogramUrl = _extractIdeogramUrl(coverPort)
  if (ideogramUrl) return _downloadImageToBase64(ideogramUrl)

  if (typeof coverPort === 'string') {
    // Markdown image with base64 data URI
    const mInline = coverPort.match(/!\[.*?\]\(data:image\/(?:png|jpeg|jpg);base64,([A-Za-z0-9+/=\n]+)\)/)
    if (mInline) return mInline[1].replace(/\n/g, '')
    // Plain URL
    if (/^https?:\/\//.test(coverPort)) return _downloadImageToBase64(coverPort)
    // Raw base64 (long string with no spaces)
    if (coverPort.length > 100 && !/\s/.test(coverPort.trim())) return coverPort.trim()
    return null
  }

  if (Array.isArray(coverPort)) {
    const flat = coverPort.map(c => (c && typeof c === 'object') ? (c.text || '') : String(c || '')).join('')
    const mInline = flat.match(/!\[.*?\]\(data:image\/(?:png|jpeg|jpg);base64,([A-Za-z0-9+/=\n]+)\)/)
    if (mInline) return mInline[1].replace(/\n/g, '')
    if (/^https?:\/\//.test(flat.trim())) return _downloadImageToBase64(flat.trim())
    return null
  }

  if (coverPort && typeof coverPort === 'object') {
    if (typeof coverPort.cover_base64 === 'string') return coverPort.cover_base64
    // Lightweight sentinel from cuda_id4_generate — read from temp file on disk
    if (typeof coverPort.__ck8t_file_path === 'string') {
      return fs.readFileSync(coverPort.__ck8t_file_path).toString('base64')
    }
  }

  return null
}

/**
 * Resolve a single scene image value to base64.
 * Same logic as _resolveCoverBase64 but for per-scene entries.
 */
async function _resolveSceneImageBase64(raw) {
  if (!raw) return null

  // Ideogram response object with data[0].url
  const ideogramUrl = _extractIdeogramUrl(raw)
  if (ideogramUrl) return _downloadImageToBase64(ideogramUrl)

  if (typeof raw === 'string') {
    const m = raw.match(/!\[.*?\]\(data:image\/(?:png|jpeg|jpg);base64,([A-Za-z0-9+/=\n]+)\)/)
    if (m) return m[1].replace(/\n/g, '')
    if (/^https?:\/\//.test(raw)) return _downloadImageToBase64(raw)
    if (raw.length > 100 && !/\s/.test(raw.trim())) return raw.trim()
    return null
  }

  if (Array.isArray(raw)) {
    const flat = raw.map(c => (c && typeof c === 'object') ? (c.text || '') : String(c || '')).join('')
    const m = flat.match(/!\[.*?\]\(data:image\/(?:png|jpeg|jpg);base64,([A-Za-z0-9+/=\n]+)\)/)
    if (m) return m[1].replace(/\n/g, '')
    if (/^https?:\/\//.test(flat.trim())) return _downloadImageToBase64(flat.trim())
    return null
  }

  if (raw && typeof raw === 'object') {
    if (typeof raw.base64 === 'string') return raw.base64
    // Lightweight sentinel from cuda_id4_generate — read from temp file on disk
    if (typeof raw.__ck8t_file_path === 'string') {
      return fs.readFileSync(raw.__ck8t_file_path).toString('base64')
    }
  }

  return null
}

/* ── Export ── */

module.exports = [
  {
    type: 'story_splitter',
    hasProgress: true,
    run({ values, input, progress }) { return runStorySplitter({ values, input, progress }) },
  },
  {
    type: 'storybook_pdf',
    hasProgress: true,
    async run({ values, input, inputsByHandle, callTool, callAgent, progress }) {
      return runStorybookPdf({ values, input, inputsByHandle, callTool, callAgent, progress })
    },
  },
]
