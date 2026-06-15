export default {
  type: 'storybook_pdf',
  name: 'Storybook PDF',
  description: 'Render scenes into a styled PDF — generates one AI image per scene (kids-book layout)',
  category: 'custom',
  bgColor: '#dc2626',
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
    { id: 'font_size_heading',    title: 'Heading font size', type: 'short-input', placeholder: '18' },
    { id: 'font_size_body',       title: 'Body font size',    type: 'short-input', placeholder: '11' },
    { id: 'include_page_numbers', title: 'Page numbers',      type: 'switch',      value: () => true },
    {
      id: 'output_path',
      title: 'Save to path',
      type: 'short-input',
      placeholder: '~/Desktop/storybook.pdf  (blank = return base64)',
    },

    /* ── Per-scene image generation ── */
    {
      id: 'generate_scene_images',
      title: 'Generate scene images',
      type: 'switch',
      value: () => true,
      description: 'Generate one AI image per scene and embed it above the text (kids-book layout).',
    },
    {
      id: 'mcp_server',
      title: 'Image MCP server',
      type: 'short-input',
      placeholder: 'ideogram4',
      description: 'MCP server ID that provides magic_prompt and generate_image tools.',
    },
    {
      id: 'image_model',
      title: 'Art director model',
      type: 'short-input',
      placeholder: 'gpt-4.1',
      description: 'LLM used to write the image prompt for each scene.',
    },
    {
      id: 'art_style',
      title: 'Art style',
      type: 'long-input',
      placeholder: "Indian 90s children's book illustration, warm colours, flat style, expressive animal faces",
      description: 'Style description passed to the art director agent for every scene image.',
    },
  ],
  inputs: {
    input: { type: 'any', description: 'scenes[] array or object with .scenes from Story Splitter' },
  },
  outputs: {
    path:       { type: 'string', description: 'Absolute path of written PDF (when output_path is set)' },
    pages:      { type: 'number', description: 'Total page count' },
    size_bytes: { type: 'number', description: 'File size in bytes' },
    pdf_base64: { type: 'string', description: 'Base64-encoded PDF (when no output_path)' },
  },
}
