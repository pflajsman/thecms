import type { Field } from '@/types'

export interface ModelTemplate {
  id: 'blog-post' | 'page' | 'event'
  name: string
  description: string
  fields: Field[]
  titleField: string
}

export const MODEL_TEMPLATES: ModelTemplate[] = [
  {
    id: 'blog-post',
    name: 'Blog post',
    description: 'Title, excerpt, cover image and body.',
    titleField: 'title',
    fields: [
      { name: 'title', label: 'Title', type: 'TEXT', required: true, validation: { maxLength: 150 } },
      { name: 'excerpt', label: 'Excerpt', type: 'TEXT', required: false, description: 'Short summary for lists and previews.', validation: { maxLength: 300 } },
      { name: 'coverImage', label: 'Cover image', type: 'MEDIA', required: false, validation: { allowedMimeTypes: ['image/*'] } },
      { name: 'body', label: 'Body', type: 'RICH_TEXT', required: false },
    ],
  },
  {
    id: 'page',
    name: 'Page',
    description: 'A standalone page such as About or Contact.',
    titleField: 'title',
    fields: [
      { name: 'title', label: 'Title', type: 'TEXT', required: true },
      { name: 'key', label: 'Page key', type: 'TEXT', required: true, description: 'Used by your site to find this page, for example "about".', validation: { pattern: '^[a-z0-9-]+$' } },
      { name: 'subtitle', label: 'Subtitle', type: 'TEXT', required: false },
      { name: 'body', label: 'Body', type: 'RICH_TEXT', required: false },
    ],
  },
  {
    id: 'event',
    name: 'Event',
    description: 'Date, location, image and description.',
    titleField: 'title',
    fields: [
      { name: 'title', label: 'Title', type: 'TEXT', required: true },
      { name: 'date', label: 'Date', type: 'DATE', required: true },
      { name: 'location', label: 'Location', type: 'TEXT', required: false },
      { name: 'image', label: 'Image', type: 'MEDIA', required: false, validation: { allowedMimeTypes: ['image/*'] } },
      { name: 'description', label: 'Description', type: 'RICH_TEXT', required: false },
    ],
  },
]
