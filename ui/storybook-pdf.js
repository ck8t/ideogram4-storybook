export default {
  type: 'storybook_pdf',
  name: 'Storybook PDF',
  description: 'Render scenes into a styled PDF. Connect the "images" port to supply pre-generated images, or enable built-in MCP generation (advanced).',
  category: 'custom',
  group: 'Storybook',
  bgColor: '#dc2626',
  iconSvg: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z|M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
  hasProgress: true,
  subBlocks: [
    { id: 'title',  title: 'Document title', type: 'short-input', placeholder: 'My Storybook' },
    { id: 'author', title: 'Author',          type: 'short-input', placeholder: 'Optional author name' },
    {
      id: 'page_size',
      title: 'Page size',
      type: 'dropdown',
      options: [
        { label: 'A4',     id: 'A4' },
        { label: 'Letter', id: 'Letter' },
        { label: 'A5',     id: 'A5' },
        { label: 'Square', id: 'Square' },
      ],
      value: () => 'A4',
    },
    {
      id: 'layout',
      title: 'Layout',
      type: 'dropdown',
      options: [
        { label: 'Title page + scenes', id: 'title_scenes' },
        { label: 'Scenes only',         id: 'scenes_only' },
      ],
      value: () => 'title_scenes',
    },
    { id: 'font_size_heading',    title: 'Heading font size', type: 'short-input', placeholder: '18', mode: 'advanced' },
    { id: 'font_size_body',       title: 'Body font size',    type: 'short-input', placeholder: '11', mode: 'advanced' },
    { id: 'include_page_numbers', title: 'Page numbers',      type: 'switch',      value: () => true, mode: 'advanced' },
    {
      id: 'output_path',
      title: 'Save to path',
      type: 'short-input',
      placeholder: '~/Desktop/storybook.pdf  (blank = return base64)',
      mode: 'advanced',
    },

    /* ── Built-in MCP image generation (advanced / disabled by default) ──────────
       Preferred design: connect pre-generated images via the "images" input port.
       These sub-blocks only apply when the "images" port is NOT connected. */
    {
      id: 'generate_scene_images',
      title: 'Built-in scene image generation (MCP)',
      type: 'switch',
      value: () => false,
      mode: 'advanced',
      description: 'Generate one image per scene using an internal MCP call. Ignored when images are supplied via the "images" input port.',
    },
    {
      id: 'magic_prompt_mcp_server',
      title: 'magic_prompt MCP server',
      type: 'mcp-server-selector',
      mode: 'advanced',
      placeholder: 'Select MCP server for magic_prompt',
      description: 'MCP server with the magic_prompt tool. Leave blank to skip enhancement.',
      condition: { field: 'generate_scene_images', value: true },
    },
    {
      id: 'mcp_server',
      title: 'Image generation MCP server',
      type: 'mcp-server-selector',
      mode: 'advanced',
      placeholder: 'Select MCP server for generate_image',
      description: 'MCP server with the generate_image tool (e.g. ideogram4). Required when built-in generation is on.',
      condition: { field: 'generate_scene_images', value: true },
    },
    {
      id: 'image_model',
      title: 'Art director model',
      type: 'llm-model-selector',
      mode: 'advanced',
      placeholder: 'Select model for art direction prompts',
      description: 'LLM used to write the image prompt for each scene (built-in generation only).',
      condition: { field: 'generate_scene_images', value: true },
    },
    {
      id: 'art_style',
      title: 'Art style',
      type: 'long-input',
      mode: 'advanced',
      placeholder: "Indian 90s children's book illustration, warm colours, flat style, expressive animal faces",
      description: 'Style description passed to the art director agent for every scene image (built-in generation only).',
      condition: { field: 'generate_scene_images', value: true },
    },
  ],

  async run({ values, input, inputsByHandle, progress }) {
    progress?.({ pct: 5, step: 1, total: 3, label: 'Connecting to bridge…' })

    const base = (
      (typeof globalThis !== 'undefined' && globalThis.__CK8T_BRIDGE_BASE__) ||
      'http://127.0.0.1:3001/api/v1'
    ).replace(/\/$/, '')

    progress?.({ pct: 20, step: 2, total: 3, label: 'Generating PDF…' })

    const res = await fetch(`${base}/ck8t/run-block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'storybook_pdf', values, input, inputsByHandle }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Storybook PDF bridge error ${res.status}: ${text}`)
    }

    progress?.({ pct: 90, step: 3, total: 3, label: 'Reading result…' })

    const { output } = await res.json()
    return output
  },

  inputs: {
    input:  { type: 'any',   description: 'scenes[] array or object with .scenes from Story Splitter' },
    images: { type: 'array', description: 'Pre-generated images (base64 or MCP content, one per scene). When connected, built-in MCP generation is skipped.' },
    cover:  { type: 'any',   description: 'Cover image — base64 string, MCP content array, or {cover_base64}. Shown on the title page.' },
  },
  outputs: {
    path:       { type: 'string', description: 'Absolute path of written PDF (when output_path is set)' },
    pages:      { type: 'number', description: 'Total page count' },
    size_bytes: { type: 'number', description: 'File size in bytes' },
    pdf_base64: { type: 'string', description: 'Base64-encoded PDF (when no output_path)' },
  },
}
