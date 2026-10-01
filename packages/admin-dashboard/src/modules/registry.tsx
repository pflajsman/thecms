import {
  Boxes,
  ClipboardList,
  FileText,
  House,
  Image as ImageIcon,
  Inbox,
  KeyRound,
  Languages,
  Plus,
  ShoppingBag,
  Store,
  Upload,
  Webhook,
} from 'lucide-react'
import { Navigate } from 'react-router-dom'
import type { AppModule, CreateAction } from './types'
import { ModelsListPage } from '@/features/models/pages/ModelsListPage'
import { ModelBuilderPage } from '@/features/models/pages/ModelBuilderPage'
import { RedirectWithId } from '@/features/legacy-redirects'
import { InboxPage } from '@/features/inbox/pages/InboxPage'
import { FormsListPage } from '@/features/forms/pages/FormsListPage'
import { FormBuilderPage } from '@/features/forms/pages/FormBuilderPage'
import { useUnreadCount } from '@/lib/queries/stats'
import { HomePage } from '@/features/home/pages/HomePage'
import { ContentListPage } from '@/features/content/pages/ContentListPage'
import { EntryEditorPage } from '@/features/content/pages/EntryEditorPage'
import { LegacyEditEntryRedirect, LegacyEntriesRedirect, LegacyNewEntryRedirect } from '@/features/content/LegacyRedirects'
import { MediaLibraryPage } from '@/features/media/pages/MediaLibraryPage'
import { SitesListPage } from '@/features/sites/pages/SitesListPage'
import { SiteFormPage } from '@/features/sites/pages/SiteFormPage'
import { WebhooksListPage } from '@/features/webhooks/pages/WebhooksListPage'
import { WebhookFormPage } from '@/features/webhooks/pages/WebhookFormPage'
import { LanguagesPage } from '@/features/languages/pages/LanguagesPage'
import { ComingSoon } from '@/features/commerce/ComingSoon'

export const modules: AppModule[] = [
  {
    id: 'home',
    labelKey: 'nav.home',
    icon: House,
    group: 'workspace',
    path: '/',
    mobileTab: true,
    routes: [{ index: true, element: <HomePage /> }],
  },
  {
    id: 'content',
    labelKey: 'nav.content',
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
    labelKey: 'nav.media',
    icon: ImageIcon,
    group: 'workspace',
    path: '/media',
    mobileTab: true,
    routes: [{ path: 'media', element: <MediaLibraryPage /> }],
  },
  {
    id: 'inbox',
    labelKey: 'nav.inbox',
    icon: Inbox,
    group: 'workspace',
    path: '/inbox',
    mobileTab: true,
    useBadge: useUnreadCount,
    routes: [
      { path: 'inbox', element: <InboxPage /> },
      { path: 'inbox/:submissionId', element: <InboxPage /> },
    ],
  },
  {
    id: 'products',
    labelKey: 'nav.products',
    icon: ShoppingBag,
    group: 'commerce',
    path: '/commerce/products',
    routes: [
      { path: 'commerce/products', element: <ComingSoon /> },
      { path: 'commerce/products/:id', element: <ComingSoon /> },
      { path: 'commerce/products/:id/content/:versionId', element: <ComingSoon /> },
    ],
  },
  {
    id: 'shop-settings',
    labelKey: 'nav.shopSettings',
    icon: Store,
    group: 'commerce',
    path: '/commerce/settings',
    routes: [{ path: 'commerce/settings', element: <ComingSoon /> }],
  },
  {
    id: 'models',
    labelKey: 'nav.models',
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
    labelKey: 'nav.forms',
    icon: ClipboardList,
    group: 'setup',
    path: '/forms',
    matches: ['/contact-forms'],
    routes: [
      { path: 'forms', element: <FormsListPage /> },
      { path: 'forms/:id', element: <FormBuilderPage /> },
      { path: 'contact-forms', element: <Navigate to="/forms" replace /> },
      { path: 'contact-forms/new', element: <Navigate to="/forms/new" replace /> },
      { path: 'contact-forms/:id/edit', element: <RedirectWithId to={(id) => `/forms/${id}`} /> },
      { path: 'contact-forms/:formId/submissions', element: <RedirectWithId to={(id) => `/inbox?form=${id}&view=all`} /> },
    ],
  },
  {
    id: 'sites',
    labelKey: 'nav.sites',
    icon: KeyRound,
    group: 'setup',
    path: '/sites',
    routes: [
      { path: 'sites', element: <SitesListPage /> },
      { path: 'sites/:id', element: <SiteFormPage /> },
      { path: 'sites/:id/edit', element: <RedirectWithId to={(id) => `/sites/${id}`} /> },
    ],
  },
  {
    id: 'webhooks',
    labelKey: 'nav.webhooks',
    icon: Webhook,
    group: 'setup',
    path: '/webhooks',
    routes: [
      { path: 'webhooks', element: <WebhooksListPage /> },
      { path: 'webhooks/:id', element: <WebhookFormPage /> },
    ],
  },
  {
    id: 'languages',
    labelKey: 'nav.languages',
    icon: Languages,
    group: 'setup',
    path: '/languages',
    routes: [{ path: 'languages', element: <LanguagesPage /> }],
  },
]

export const createActions: CreateAction[] = [
  { id: 'new-entry', labelKey: 'create.newEntry', to: '/content/new', icon: Plus },
  { id: 'upload-media', labelKey: 'create.uploadMedia', to: '/media', icon: Upload },
]
