export default {
  type: 'story_splitter',
  name: 'Story Splitter',
  description: 'Split a story into scenes or chapters',
  category: 'custom',
  bgColor: '#7c3aed',
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
}
