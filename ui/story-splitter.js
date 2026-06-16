export default {
  type: 'story_splitter',
  name: 'Story Splitter',
  description: 'Split a story into scenes or chapters',
  category: 'custom',
  group: 'Storybook',
  bgColor: '#7c3aed',
  iconSvg: 'M12 3L12 11|M12 11L7 20|M12 11L17 20',
  hasProgress: true,
  subBlocks: [
    {
      id: 'split_by',
      title: 'Split by',
      type: 'dropdown',
      options: [
        { label: 'Chapter  (# heading)',   id: 'chapter' },
        { label: 'Scene    (## heading)',  id: 'scene' },
        { label: 'Paragraph (blank line)', id: 'paragraph' },
        { label: 'Custom delimiter',        id: 'delimiter' },
      ],
      value: () => 'scene',
    },
    {
      id: 'delimiter',
      title: 'Delimiter',
      type: 'short-input',
      placeholder: '---',
      description: 'Used only when Split by = Custom delimiter.',
      mode: 'advanced',
    },
    {
      id: 'include_heading',
      title: 'Include heading in content',
      type: 'switch',
      value: () => false,
    },
    {
      id: 'max_scenes',
      title: 'Max scenes',
      type: 'short-input',
      placeholder: '0  (unlimited)',
      mode: 'advanced',
    },
  ],
  inputs:  { input: { type: 'any',    description: 'Story text or object with .text / .content / .story field' } },
  outputs: {
    scenes: { type: 'array',  description: 'Array of { index, title, content }' },
    count:  { type: 'number', description: 'Scene count' },
    first:  { type: 'json',   description: 'First scene' },
    last:   { type: 'json',   description: 'Last scene' },
  },

  run({ values, input, progress }) {
    let text = ''
    if (typeof input === 'string') {
      text = input
    } else if (input && typeof input === 'object') {
      text = String(input.text ?? input.content ?? input.story ?? input.body ?? JSON.stringify(input))
    }

    progress?.({ pct: 10, step: 1, total: 3, label: 'Parsing text…' })

    const splitBy        = String(values.split_by || 'scene')
    const delimiter      = String(values.delimiter || '\n\n---\n\n')
    const includeHeading = values.include_heading === true
    const maxScenes      = Math.max(0, parseInt(String(values.max_scenes || '0'), 10) || 0)
    let scenes = []

    if (splitBy === 'chapter' || splitBy === 'scene') {
      const depth  = splitBy === 'chapter' ? 1 : 2
      const prefix = '#'.repeat(depth)
      const headRe = new RegExp('^' + prefix + '(?!#)\\s+(.+)$')
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
        if (m) { flush(); currentTitle = m[1].trim(); currentLines = includeHeading ? [line] : [] }
        else currentLines.push(line)
      }
      flush()
    } else if (splitBy === 'paragraph') {
      scenes = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
        .map((content, i) => ({ title: 'Scene ' + (i + 1), content }))
    } else {
      scenes = text.split(delimiter).map((p) => p.trim()).filter(Boolean)
        .map((content, i) => ({ title: 'Scene ' + (i + 1), content }))
    }

    if (maxScenes > 0) scenes = scenes.slice(0, maxScenes)

    progress?.({ pct: 70, step: 2, total: 3, label: `Indexing ${scenes.length} scenes…` })

    const indexed = scenes.map((s, i) => ({ index: i + 1, ...s }))

    progress?.({ pct: 100, step: 3, total: 3, label: `${indexed.length} scenes ready` })

    return { scenes: indexed, count: indexed.length, first: indexed[0] ?? null, last: indexed[indexed.length - 1] ?? null }
  },
}
