/**
 * ideogram4-storybook — extension runner (Node.js / VS Code extension host).
 *
 * story_splitter : pure JS transform — runs everywhere.
 * storybook_pdf  : uses pdf-lib — Node.js only, runs here.
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

async function runStorybookPdf({ values, input }) {
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
  const fs   = require('node:fs')
  const path = require('node:path')
  const os   = require('node:os')

  let scenes = []
  if (Array.isArray(input)) {
    scenes = input
  } else if (input && typeof input === 'object') {
    scenes = Array.isArray(input.scenes) ? input.scenes
           : Array.isArray(input.items)  ? input.items
           : []
  }

  const docTitle   = String(values.title || 'Storybook')
  const docAuthor  = String(values.author || '')
  const pageSz     = String(values.page_size || 'A4')
  const layout     = String(values.layout || 'title_scenes')
  const fsHead     = Math.max(8, parseFloat(String(values.font_size_heading || '18')))
  const fsBody     = Math.max(6, parseFloat(String(values.font_size_body   || '11')))
  const pageNums   = values.include_page_numbers !== false
  const outPath    = values.output_path ? String(values.output_path) : null

  const SIZES = { A4: [595.28, 841.89], Letter: [612, 792], A5: [419.53, 595.28], Square: [600, 600] }
  const [W, H] = SIZES[pageSz] || SIZES.A4
  const MARGIN = 50

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

  if (layout === 'title_scenes') {
    const tp = pdfDoc.addPage([W, H])
    const ty = H / 2 + 60
    tp.drawRectangle({ x: MARGIN, y: ty - 10, width: W - MARGIN * 2, height: 3, color: accent })
    tp.drawText(docTitle.toUpperCase(), { x: MARGIN, y: ty + 20, font: fontHead, size: fsHead + 8, color: ink })
    if (docAuthor) tp.drawText(`by ${docAuthor}`, { x: MARGIN, y: ty - 30, font: fontBody, size: fsBody + 2, color: muted })
    tp.drawText(`${scenes.length} scene${scenes.length !== 1 ? 's' : ''}`, { x: MARGIN, y: MARGIN, font: fontBody, size: fsBody - 1, color: muted })
  }

  for (let i = 0; i < scenes.length; i++) {
    const scene   = scenes[i]
    const title   = String(scene.title || `Scene ${i + 1}`)
    const content = String(scene.content ?? scene.text ?? scene.body ?? '')
    const page    = pdfDoc.addPage([W, H])
    const maxW    = W - MARGIN * 2
    let y         = H - MARGIN

    page.drawText(String(i + 1), { x: MARGIN, y, font: fontHead, size: fsBody - 1, color: accent })
    y -= fsHead + 8
    y = drawWrapped(page, title, { x: MARGIN, y, maxW, font: fontHead, size: fsHead, color: ink, lh: fsHead * 1.3 })
    y -= 12
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 40, y }, thickness: 2, color: accent })
    y -= 20

    for (const para of content.split(/\n{2,}/)) {
      if (y < MARGIN + 60) break
      y = drawWrapped(page, para.trim(), { x: MARGIN, y, maxW, font: fontBody, size: fsBody, color: ink, lh: fsBody * 1.6 })
      y -= fsBody * 0.8
    }

    if (pageNums) {
      page.drawText(String(pdfDoc.getPageCount()), { x: W / 2 - 5, y: MARGIN / 2, font: fontBody, size: fsBody - 1, color: muted })
    }
  }

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

/* ── Export ── */

module.exports = [
  {
    type: 'story_splitter',
    run({ values, input }) { return runStorySplitter({ values, input }) },
  },
  {
    type: 'storybook_pdf',
    async run({ values, input }) { return runStorybookPdf({ values, input }) },
  },
]
