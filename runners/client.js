/**
 * ideogram4-storybook — client runner (browser).
 *
 * story_splitter runs fine in the browser (pure JS).
 * storybook_pdf requires Node.js (pdf-lib) — throws a helpful error.
 */
'use strict'

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

module.exports = [
  {
    type: 'story_splitter',
    run({ values, input }) { return runStorySplitter({ values, input }) },
  },
  {
    type: 'storybook_pdf',
    async run(ctx) {
      // pdf-lib is Node-only — delegate to extension.js via the bridge.
      // If the Debugger tab has breakpoints on extension.js, graph-runner.js
      // sets ctx.__ck8tExtDebug which we forward here as __ck8tDebug so the
      // bridge runs extension.js debug-instrumented for that session.
      const bridgeBase = (globalThis.__CK8T_BRIDGE_BASE__ || 'http://127.0.0.1:3000').replace(/\/$/, '')
      const body = {
        type: 'storybook_pdf',
        values: ctx.values ?? {},
        input: ctx.input ?? null,
        inputsByHandle: ctx.inputsByHandle ?? {},
      }
      if (ctx.__ck8tExtDebug) body.__ck8tDebug = ctx.__ck8tExtDebug

      const res = await fetch(`${bridgeBase}/ck8t/run-block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      return data.output
    },
  },
]
