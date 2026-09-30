import type { Field } from '@/types'
import { i18n } from '@/i18n'

export interface ModelTemplate {
  id: 'blog-post' | 'page' | 'event'
  name: string
  description: string
  fields: Field[]
  titleField: string
}

/**
 * Built on each call so a template picked in Czech gets Czech names, labels and help text.
 * Field keys (`name`) stay the same in every language, so API consumers are unaffected.
 */
export function getModelTemplates(): ModelTemplate[] {
  const t = (key: string) => i18n.t(`models:templates.${key}`)
  return [
    {
      id: 'blog-post',
      name: t('blogPost.name'),
      description: t('blogPost.description'),
      titleField: 'title',
      fields: [
        { name: 'title', label: t('blogPost.fields.title'), type: 'TEXT', required: true, validation: { maxLength: 150 } },
        { name: 'excerpt', label: t('blogPost.fields.excerpt'), type: 'TEXT', required: false, description: t('blogPost.help.excerpt'), validation: { maxLength: 300 } },
        { name: 'coverImage', label: t('blogPost.fields.coverImage'), type: 'MEDIA', required: false, validation: { allowedMimeTypes: ['image/*'] } },
        { name: 'body', label: t('blogPost.fields.body'), type: 'RICH_TEXT', required: false },
      ],
    },
    {
      id: 'page',
      name: t('page.name'),
      description: t('page.description'),
      titleField: 'title',
      fields: [
        { name: 'title', label: t('page.fields.title'), type: 'TEXT', required: true },
        { name: 'key', label: t('page.fields.key'), type: 'TEXT', required: true, description: t('page.help.key'), validation: { pattern: '^[a-z0-9-]+$' } },
        { name: 'subtitle', label: t('page.fields.subtitle'), type: 'TEXT', required: false },
        { name: 'body', label: t('page.fields.body'), type: 'RICH_TEXT', required: false },
      ],
    },
    {
      id: 'event',
      name: t('event.name'),
      description: t('event.description'),
      titleField: 'title',
      fields: [
        { name: 'title', label: t('event.fields.title'), type: 'TEXT', required: true },
        { name: 'date', label: t('event.fields.date'), type: 'DATE', required: true },
        { name: 'location', label: t('event.fields.location'), type: 'TEXT', required: false },
        { name: 'image', label: t('event.fields.image'), type: 'MEDIA', required: false, validation: { allowedMimeTypes: ['image/*'] } },
        { name: 'description', label: t('event.fields.description'), type: 'RICH_TEXT', required: false },
      ],
    },
  ]
}
