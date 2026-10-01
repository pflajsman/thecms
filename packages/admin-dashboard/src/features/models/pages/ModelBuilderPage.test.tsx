import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { i18n } from '@/i18n'
import { setViewport } from '@/test/viewport'
import type { ContentType } from '@/types'
import * as contentApi from '@/features/content/content-api'
import * as modelsApi from '../models-api'
import { ModelBuilderPage } from './ModelBuilderPage'
import * as languagesApi from '@/features/languages/languages-api'

vi.mock('@/features/content/content-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/content/content-api')>()
  return { ...actual, getContentType: vi.fn(), listContentTypes: vi.fn() }
})
vi.mock('../models-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../models-api')>()
  return { ...actual, createModel: vi.fn(), updateModel: vi.fn(), deleteModel: vi.fn(), getEntryCount: vi.fn() }
})

vi.mock('@/features/languages/languages-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/languages/languages-api')>()),
  listLanguages: vi.fn(),
}))

const en = { id: 'l1', code: 'en', name: 'English', isDefault: true, order: 0 }
const cs = { id: 'l2', code: 'cs', name: 'Čeština', isDefault: false, order: 1 }

const trip: ContentType = {
  id: 't1',
  name: 'Trip',
  slug: 'trip',
  titleField: 'title',
  fields: [
    { name: 'title', label: 'Title', type: 'TEXT', required: true },
    { name: 'gpxurl', label: 'GPX track', type: 'MEDIA', required: false },
  ],
  createdAt: '',
  updatedAt: '',
}

const routes = [
  { path: '/models/:id', element: <ModelBuilderPage /> },
  { path: '/models', element: <p>models list</p> },
]

beforeEach(() => {
  setViewport(true)
  vi.mocked(contentApi.listContentTypes).mockResolvedValue([trip])
  vi.mocked(contentApi.getContentType).mockResolvedValue(trip)
  vi.mocked(modelsApi.getEntryCount).mockResolvedValue(8)
  vi.mocked(languagesApi.listLanguages).mockResolvedValue([en])
})

describe('new model', () => {
  it('starts from a template and saves it', async () => {
    vi.mocked(modelsApi.createModel).mockImplementation(async (body) => ({ ...trip, ...body, id: 'new1' }) as ContentType)
    const { router } = renderRoutes(routes, { route: '/models/new' })
    await userEvent.click(await screen.findByRole('button', { name: /Blog post/ }))
    expect(screen.getByLabelText('Name')).toHaveValue('Blog post')
    expect(within(screen.getByRole('list', { name: 'Fields' })).getAllByRole('listitem')).toHaveLength(4)
    await userEvent.click(screen.getByRole('button', { name: 'Save model' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/models/new1'))
    expect(modelsApi.createModel).toHaveBeenCalledWith(expect.objectContaining({ name: 'Blog post', slug: 'blog-post', titleField: 'title' }))
  })

  it('adds a field from the palette with a camelCase key from its label', async () => {
    renderRoutes(routes, { route: '/models/new?template=scratch' })
    await userEvent.type(await screen.findByLabelText('Name'), 'Trip')
    await userEvent.click(screen.getByRole('button', { name: 'Add Text field' }))
    const inspector = screen.getByRole('complementary', { name: 'Field settings' })
    const label = within(inspector).getByLabelText('Label')
    await userEvent.clear(label)
    await userEvent.type(label, 'GPX URL')
    expect(within(inspector).getByLabelText('API key')).toHaveValue('gpxUrl')
  })

  it('blocks save with errors shown on the field', async () => {
    renderRoutes(routes, { route: '/models/new?template=scratch' })
    await userEvent.type(await screen.findByLabelText('Name'), 'Trip')
    await userEvent.click(screen.getByRole('button', { name: 'Add Text field' }))
    const key = within(screen.getByRole('complementary', { name: 'Field settings' })).getByLabelText('API key')
    await userEvent.clear(key)
    await userEvent.type(key, '9lives')
    await userEvent.click(screen.getByRole('button', { name: 'Save model' }))
    expect(await screen.findByText('Start with a letter; use only letters, numbers and underscores')).toBeInTheDocument()
    expect(modelsApi.createModel).not.toHaveBeenCalled()
  })
})

describe('existing model with entries', () => {
  it('confirms renamed keys with the entry count before saving', async () => {
    vi.mocked(modelsApi.updateModel).mockImplementation(async (_id, body) => ({ ...trip, ...body }) as ContentType)
    renderRoutes(routes, { route: '/models/t1' })
    await userEvent.click(await screen.findByRole('button', { name: /^GPX track/ }))
    const inspector = screen.getByRole('complementary', { name: 'Field settings' })
    expect(within(inspector).getByText(/Sites reading this key stop receiving it if you rename it/)).toBeInTheDocument()
    const key = within(inspector).getByLabelText('API key')
    await userEvent.clear(key)
    await userEvent.type(key, 'gpxUrl')
    await userEvent.click(screen.getByRole('button', { name: 'Save model' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('8 entries')
    expect(dialog).toHaveTextContent('gpxurl → gpxUrl')
    expect(modelsApi.updateModel).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(modelsApi.updateModel).toHaveBeenCalledWith('t1', expect.objectContaining({ fields: expect.arrayContaining([expect.objectContaining({ name: 'gpxUrl' })]) }))
  })

  it('requires typing the model name to delete a model with entries', async () => {
    vi.mocked(modelsApi.deleteModel).mockResolvedValue()
    const { router } = renderRoutes(routes, { route: '/models/t1' })
    await userEvent.click(await screen.findByRole('button', { name: 'Delete model' }))
    const dialog = await screen.findByRole('alertdialog')
    const confirm = within(dialog).getByRole('button', { name: 'Delete' })
    expect(confirm).toBeDisabled()
    await userEvent.type(within(dialog).getByLabelText(/type/i), 'Trip')
    await userEvent.click(confirm)
    expect(modelsApi.deleteModel).toHaveBeenCalledWith('t1', true)
    await waitFor(() => expect(router.state.location.pathname).toBe('/models'))
  })

  it('opens the field inspector in a bottom sheet on small screens', async () => {
    setViewport(false)
    renderRoutes(routes, { route: '/models/t1' })
    await userEvent.click(await screen.findByRole('button', { name: /^GPX track/ }))
    expect(await screen.findByRole('dialog', { name: 'Field settings' })).toBeInTheDocument()
  })
})

it('replaces the history entry when a template is chosen, so Back leaves through the guard', async () => {
  const { router } = renderRoutes(routes, { route: '/models/new' })
  await userEvent.click(await screen.findByRole('button', { name: /Blog post/ }))
  expect(router.state.historyAction).toBe('REPLACE')
})

it('still confirms key renames when the entry count cannot be loaded', async () => {
  vi.mocked(modelsApi.getEntryCount).mockRejectedValue(new Error('down'))
  renderRoutes(routes, { route: '/models/t1' })
  await userEvent.click(await screen.findByRole('button', { name: /^GPX track/ }))
  const key = within(screen.getByRole('complementary', { name: 'Field settings' })).getByLabelText('API key')
  await userEvent.clear(key)
  await userEvent.type(key, 'gpxUrl')
  await userEvent.click(screen.getByRole('button', { name: 'Save model' }))
  expect(await screen.findByRole('alertdialog')).toHaveTextContent('This model may have entries')
  expect(modelsApi.updateModel).not.toHaveBeenCalled()
})

describe('in Czech', () => {
  it('creates a model from a template with Czech labels and English keys', async () => {
    await setTestLanguage('cs')
    vi.mocked(modelsApi.createModel).mockImplementation(async (body) => ({ ...trip, ...body, id: 'new1' }) as ContentType)
    renderRoutes(routes, { route: '/models/new' })
    await userEvent.click(await screen.findByRole('button', { name: /Článek blogu/ }))
    expect(screen.getByLabelText('Název')).toHaveValue('Článek blogu')
    const fields = within(screen.getByRole('list', { name: 'Pole' }))
    expect(fields.getByText('Titulní obrázek')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Uložit model' }))
    await waitFor(() => expect(modelsApi.createModel).toHaveBeenCalledWith(expect.objectContaining({ name: 'Článek blogu', slug: 'clanek-blogu', titleField: 'title' })))
    const sent = vi.mocked(modelsApi.createModel).mock.calls[0][0]
    expect(sent.fields.map((f: { name: string }) => f.name)).toEqual(['title', 'excerpt', 'coverImage', 'body'])
    expect(sent.fields[2].label).toBe('Titulní obrázek')
  })

  it('shows the field palette in Czech after switching language', async () => {
    renderRoutes(routes, { route: '/models/new?template=scratch' })
    await screen.findByRole('button', { name: 'Add Text field' })
    await setTestLanguage('cs')
    expect(screen.getByRole('button', { name: 'Přidat pole Formátovaný text' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Přidat pole Ano/ne' })).toBeInTheDocument()
  })
})

it('re-translates visible model errors when the language changes', async () => {
  renderRoutes(routes, { route: '/models/new?template=scratch' })
  await userEvent.click(await screen.findByRole('button', { name: 'Save model' }))
  expect(await screen.findByText('Name must be at least 2 characters')).toBeInTheDocument()
  await setTestLanguage('cs')
  expect(await screen.findByText('Název musí mít alespoň 2 znaky')).toBeInTheDocument()
})

it('explains entry usage in the rename confirmation in natural Czech', async () => {
  await setTestLanguage('cs')
  expect(i18n.t('models:builder.usedBy', { count: 1 })).toBe('Tento model má 1 položku.')
  expect(i18n.t('models:builder.usedBy', { count: 3 })).toBe('Tento model má 3 položky.')
  expect(i18n.t('models:builder.usedBy', { count: 5 })).toBe('Tento model má 5 položek.')
})

describe('Translated setting', () => {
  it('switches a field to shared and warns before saving when the model has entries', async () => {
    vi.mocked(languagesApi.listLanguages).mockResolvedValue([en, cs])
    vi.mocked(modelsApi.updateModel).mockImplementation(async (_id, body) => ({ ...trip, ...body }) as ContentType)
    renderRoutes(routes, { route: '/models/t1' })
    await userEvent.click(await screen.findByRole('button', { name: /^Title/ }))
    const inspector = screen.getByRole('complementary', { name: 'Field settings' })
    const translated = await within(inspector).findByRole('switch', { name: 'Translated' })
    expect(translated).toBeChecked()
    await userEvent.click(translated)
    expect(within(inspector).getByText('The same value in every language.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save model' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Make fields the same in every language?' })
    expect(dialog).toHaveTextContent('title')
    expect(modelsApi.updateModel).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(modelsApi.updateModel).toHaveBeenCalledWith('t1', expect.objectContaining({
      fields: expect.arrayContaining([expect.objectContaining({ name: 'title', localized: false })]),
    }))
  })

  it('hides the Translated switch with one language', async () => {
    renderRoutes(routes, { route: '/models/t1' })
    await userEvent.click(await screen.findByRole('button', { name: /^Title/ }))
    const inspector = screen.getByRole('complementary', { name: 'Field settings' })
    expect(within(inspector).queryByRole('switch', { name: 'Translated' })).not.toBeInTheDocument()
  })
})
