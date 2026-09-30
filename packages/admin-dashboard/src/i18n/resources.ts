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

export const NAMESPACES = ['common', 'shell', 'home', 'content', 'editor'] as const

export const resources = {
  en: { common: enCommon, shell: enShell, home: enHome, content: enContent, editor: enEditor },
  cs: { common: csCommon, shell: csShell, home: csHome, content: csContent, editor: csEditor },
} as const
