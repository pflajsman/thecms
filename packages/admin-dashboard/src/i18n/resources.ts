import enCommon from './locales/en/common.json'
import enShell from './locales/en/shell.json'
import enHome from './locales/en/home.json'
import enContent from './locales/en/content.json'
import enEditor from './locales/en/editor.json'
import csCommon from './locales/cs/common.json'
import csShell from './locales/cs/shell.json'
import csHome from './locales/cs/home.json'
import csContent from './locales/cs/content.json'
import csEditor from './locales/cs/editor.json'
import enMedia from './locales/en/media.json'
import enInbox from './locales/en/inbox.json'
import enModels from './locales/en/models.json'
import enForms from './locales/en/forms.json'
import enSites from './locales/en/sites.json'
import enWebhooks from './locales/en/webhooks.json'
import enBuilder from './locales/en/builder.json'
import csMedia from './locales/cs/media.json'
import csInbox from './locales/cs/inbox.json'
import csModels from './locales/cs/models.json'
import csForms from './locales/cs/forms.json'
import csSites from './locales/cs/sites.json'
import csWebhooks from './locales/cs/webhooks.json'
import csBuilder from './locales/cs/builder.json'

export const NAMESPACES = ['common', 'shell', 'home', 'content', 'editor', 'media', 'inbox', 'models', 'forms', 'sites', 'webhooks', 'builder'] as const

export const resources = {
  en: { common: enCommon, shell: enShell, home: enHome, content: enContent, editor: enEditor, media: enMedia, inbox: enInbox, models: enModels, forms: enForms, sites: enSites, webhooks: enWebhooks, builder: enBuilder },
  cs: { common: csCommon, shell: csShell, home: csHome, content: csContent, editor: csEditor, media: csMedia, inbox: csInbox, models: csModels, forms: csForms, sites: csSites, webhooks: csWebhooks, builder: csBuilder },
} as const
