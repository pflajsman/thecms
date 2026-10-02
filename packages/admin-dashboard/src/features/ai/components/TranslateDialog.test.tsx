import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import { TranslateDialog } from './TranslateDialog'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

function sse(events: string[], hold?: Promise<void>) {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      async start(controller) {
        for (const e of events) controller.enqueue(encoder.encode(e))
        if (hold) await hold
        controller.close()
      },
    }),
    { status: 200 },
  )
}
const start = 'event: start\ndata: {"fields":[{"name":"perex","label":"Perex"},{"name":"body","label":"Body"}]}\n\n'
const field = (name: string, index: number) => `event: field\ndata: {"name":"${name}","index":${index},"total":2}\n\n`
const done = 'event: done\ndata: {"versionId":"v1","inputTokens":1,"outputTokens":1}\n\n'
const error = (code: string, fieldName?: string) => `event: error\ndata: ${JSON.stringify({ code, message: 'Server text', ...(fieldName ? { field: fieldName } : {}) })}\n\n`
const deutsch = { code: 'de', name: 'Deutsch' }

function renderDialog() {
  const props = { onDone: vi.fn(), onExists: vi.fn(), onClose: vi.fn() }
  const view = renderWithProviders(<TranslateDialog entryId="e1" language={deutsch} {...props} />)
  return { ...props, ...view }
}

it('shows each field as it is translated and hands over the new version', async () => {
  let release: () => void = () => {}
  const hold = new Promise<void>((resolve) => (release = resolve))
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(sse([start, field('perex', 1), field('body', 2)], hold))
  const { onDone, baseElement } = renderDialog()
  const dialog = await screen.findByRole('dialog', { name: 'Translating to Deutsch' })
  expect(await within(dialog).findByText('Translating Body (2 of 2)')).toBeInTheDocument()
  const items = within(dialog).getAllByRole('listitem').map((li) => li.textContent)
  expect(items).toEqual(['PerexDone', 'BodyTranslating'])
  await expectNoA11yViolations(baseElement)
  expect(onDone).not.toHaveBeenCalled()
  // The stream then ends without done: an error, never onDone.
  release()
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(onDone).not.toHaveBeenCalled()
})

it('calls onDone with the new version id', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(sse([start, field('perex', 1), field('body', 2), done]))
  const { onDone } = renderDialog()
  await waitFor(() => expect(onDone).toHaveBeenCalledWith('v1'))
})

it('stops the request when cancelled', async () => {
  let signal: AbortSignal | undefined
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    signal = init?.signal ?? undefined
    return sse([start, field('perex', 1)], new Promise(() => {}))
  })
  const { onClose, onDone, unmount } = renderDialog()
  await screen.findByText('Translating Perex (1 of 2)')
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onClose).toHaveBeenCalled()
  unmount()
  expect(signal?.aborted).toBe(true)
  expect(onDone).not.toHaveBeenCalled()
})

it('names the field that is too long and offers no retry', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(sse([start, error('TOO_LONG', 'perex')]))
  const { onClose } = renderDialog()
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Perex is too long to translate. Shorten it or translate it by hand.')
  expect(within(screen.getAllByRole('listitem')[0]).getByText('Failed')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(onClose).toHaveBeenCalled()
})

it('offers a retry after a provider error', async () => {
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(sse([start, field('perex', 1), error('RATE_LIMIT', 'perex')]))
    .mockResolvedValueOnce(sse([start, field('perex', 1), field('body', 2), done]))
  const { onDone } = renderDialog()
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('The AI service is limiting requests. Try again shortly.')
  expect(alert).toHaveTextContent('Stopped at Perex.')
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await waitFor(() => expect(onDone).toHaveBeenCalledWith('v1'))
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('links to the AI settings when the request is refused', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: false, error: 'Connect an AI service first', reason: 'NOT_CONNECTED' }), { status: 409 }))
  renderDialog()
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Connect an AI service first.')
  expect(within(alert).getByRole('link', { name: 'AI assistant settings' })).toHaveAttribute('href', '/account/ai')
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
})

it('offers to open a version created meanwhile', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: false, error: 'exists', reason: 'VERSION_EXISTS' }), { status: 409 }))
  const { onExists } = renderDialog()
  expect(await screen.findByRole('alert')).toHaveTextContent('A Deutsch version was created in the meantime.')
  await userEvent.click(screen.getByRole('button', { name: 'Open the Deutsch version' }))
  expect(onExists).toHaveBeenCalled()
})

it('speaks Czech', async () => {
  await setTestLanguage('cs')
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(sse([start, field('perex', 1)], new Promise(() => {})))
  renderDialog()
  expect(await screen.findByRole('dialog', { name: 'Překládám do jazyka Deutsch' })).toBeInTheDocument()
  expect(await screen.findByText('Překládám Perex (1 z 2)')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Zrušit' })).toBeInTheDocument()
})

it('explains a provider failure in the admin language, not with the server text', async () => {
  await setTestLanguage('cs')
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(sse([start, field('perex', 1), error('PROVIDER', 'perex')]))
  renderDialog()
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Překlad se nepodařil. Zkuste to znovu.')
  expect(alert).toHaveTextContent('Zastaveno u pole Perex.')
  expect(alert).not.toHaveTextContent('Server text')
})
