import {
  Boxes,
  ClipboardList,
  FileText,
  House,
  Image as ImageIcon,
  Inbox,
  KeyRound,
  Plus,
  Upload,
  Webhook,
} from 'lucide-react'
import { Navigate } from 'react-router-dom'
import type { AppModule, CreateAction } from './types'
import { ModelsListPage } from '@/features/models/pages/ModelsListPage'
import { ModelBuilderPage } from '@/features/models/pages/ModelBuilderPage'
import { RedirectWithId } from '@/features/legacy-redirects'
import { useUnreadCount } from '@/lib/queries/stats'
import { HomePage } from '@/features/home/pages/HomePage'
import { ContentListPage } from '@/features/content/pages/ContentListPage'
import { EntryEditorPage } from '@/features/content/pages/EntryEditorPage'
import { LegacyEditEntryRedirect, LegacyEntriesRedirect, LegacyNewEntryRedirect } from '@/features/content/LegacyRedirects'
import { MediaLibraryPage } from '@/features/media/pages/MediaLibraryPage'
import { ContactFormsList } from '@/pages/ContactForms/ContactFormsList'
import { ContactFormForm } from '@/pages/ContactForms/ContactFormForm'
import { SubmissionsList } from '@/pages/ContactForms/SubmissionsList'
import { SitesList } from '@/pages/Sites/SitesList'
import { SiteForm } from '@/pages/Sites/SiteForm'
import { InboxPlaceholder } from '@/features/inbox/pages/InboxPlaceholder'
import { WebhooksPlaceholder } from '@/features/webhooks/pages/WebhooksPlaceholder'

export const modules: AppModule[] = [
  {
    id: 'home',
    label: 'Home',
    icon: House,
    group: 'workspace',
    path: '/',
    mobileTab: true,
    routes: [{ index: true, element: <HomePage /> }],
  },
  {
    id: 'content',
    label: 'Content',
    icon: FileText,
    group: 'workspace',
    path: '/content',
    matches: ['/entries'],
    mobileTab: true,
    routes: [
      { path: 'content', element: <ContentListPage /> },
      { path: 'content/:id', element: <EntryEditorPage /> },
      { path: 'entries', element: <LegacyEntriesRedirect /> },
      { path: 'entries/new', element: <LegacyNewEntryRedirect /> },
      { path: 'entries/:id/edit', element: <LegacyEditEntryRedirect /> },
    ],
  },
  {
    id: 'media',
    label: 'Media',
    icon: ImageIcon,
    group: 'workspace',
    path: '/media',
    mobileTab: true,
    routes: [{ path: 'media', element: <MediaLibraryPage /> }],
  },
  {
    id: 'inbox',
    label: 'Inbox',
    icon: Inbox,
    group: 'workspace',
    path: '/inbox',
    mobileTab: true,
    useBadge: useUnreadCount,
    routes: [{ path: 'inbox', element: <InboxPlaceholder /> }],
  },
  {
    id: 'models',
    label: 'Content models',
    icon: Boxes,
    group: 'setup',
    path: '/models',
    matches: ['/content-types'],
    routes: [
      { path: 'models', element: <ModelsListPage /> },
      { path: 'models/:id', element: <ModelBuilderPage /> },
      { path: 'content-types', element: <Navigate to="/models" replace /> },
      { path: 'content-types/new', element: <Navigate to="/models/new" replace /> },
      { path: 'content-types/:id/edit', element: <RedirectWithId to={(id) => `/models/${id}`} /> },
    ],
  },
  {
    id: 'forms',
    label: 'Forms',
    icon: ClipboardList,
    group: 'setup',
    path: '/forms',
    matches: ['/contact-forms'],
    routes: [
      { path: 'forms', element: <ContactFormsList /> },
      { path: 'contact-forms', element: <ContactFormsList /> },
      { path: 'contact-forms/new', element: <ContactFormForm /> },
      { path: 'contact-forms/:id/edit', element: <ContactFormForm /> },
      { path: 'contact-forms/:formId/submissions', element: <SubmissionsList /> },
    ],
  },
  {
    id: 'sites',
    label: 'Sites & API keys',
    icon: KeyRound,
    group: 'setup',
    path: '/sites',
    routes: [
      { path: 'sites', element: <SitesList /> },
      { path: 'sites/new', element: <SiteForm /> },
      { path: 'sites/:id/edit', element: <SiteForm /> },
    ],
  },
  {
    id: 'webhooks',
    label: 'Webhooks',
    icon: Webhook,
    group: 'setup',
    path: '/webhooks',
    routes: [{ path: 'webhooks', element: <WebhooksPlaceholder /> }],
  },
]

export const createActions: CreateAction[] = [
  { id: 'new-entry', label: 'New entry', to: '/content/new', icon: Plus },
  { id: 'upload-media', label: 'Upload media', to: '/media', icon: Upload },
]
