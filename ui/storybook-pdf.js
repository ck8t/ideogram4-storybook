export default {
  type: 'storybook_pdf',
  name: 'Storybook PDF',
  description: 'Render scenes into a styled PDF storybook',
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
  ],
  inputs:  { input: { type: 'any', description: 'scenes[] array or object with .scenes from Story Splitter' } },
  outputs: {
    path:       { type: 'string', description: 'Absolute path of written PDF' },
    pages:      { type: 'number', description: 'Total page count' },
    size_bytes: { type: 'number', description: 'File size in bytes' },
    pdf_base64: { type: 'string', description: 'Base64 PDF (when no output_path)' },
  },
}
