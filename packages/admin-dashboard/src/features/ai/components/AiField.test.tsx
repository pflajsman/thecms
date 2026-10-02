import { useState } from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import apiClient from '@/lib/api'
import type { Field } from '@/types'
import { FieldShell } from '@/features/content/editor/fields/FieldShell'
import { AiField } from './AiField'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const ready = { available: true, enabled: true, canManage: false, connection: { provider: 'openai-compatible', model: 'm', createdAt: '2026-10-02' }, usage: { month: '2026-10', requests: 0, inputTokens: 0, outputTokens: 0 } }
const perex: Field = { name: 'perex', label: 'Perex', type: 'TEXT', required: false }
const body: Field = { name: 'body', label: 'Body', type: 'RICH_TEXT', required: false }
const context = () => ({ contentType: 'Blog post', language: 'cs', fields: [{ label: 'Title', value: 'Šumava' }] })

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
const delta = (text: string) => `event: delta\ndata: ${JSON.stringify({ text })}\n\n`
const done = (extra = '') => `event: done\ndata: {"inputTokens":1,"outputTokens":2${extra}}\n\n`

function Harness({ field, initial }: { field: Field; initial: string }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <AiField field={field} value={value} onApply={setValue} getContext={context}>
        {(version) => (
          <FieldShell field={field} id={`field-${field.name}`}>
            <input id={`field-${field.name}`} data-version={version} value={value} onChange={(e) => setValue(e.target.value)} />
          </FieldShell>
        )}
      </AiField>
      <output data-testid="value">{value}</output>
    </>
  )
}

beforeEach(() => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: ready } })
})

it('offers a draft for an empty field and the text actions for a filled one', async () => {
  const first = renderWithProviders(<Harness field={perex} initial="" />)
  await userEvent.click(await screen.findByRole('button', { name: 'AI for Perex' }))
  expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Write a draft', 'Own instruction'])
  first.unmount()
  renderWithProviders(<Harness field={perex} initial="Byli jsme tam." />)
  await userEvent.click(await screen.findByRole('button', { name: 'AI for Perex' }))
  expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Rewrite more clearly', 'Shorten', 'Expand', 'Fix spelling and grammar', 'Own instruction'])
})

it('streams a rewrite into the preview and replaces the field only on Use', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(sse([delta('Byli jsme'), delta(' na Šumavě.'), done()]))
  const { container } = renderWithProviders(<Harness field={perex} initial="Byli jsme tam." />)
  await userEvent.click(await screen.findByRole('button', { name: 'AI for Perex' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Rewrite more clearly' }))
  const panel = await screen.findByRole('region', { name: 'AI suggestion for Perex' })
  expect(await within(panel).findByText('Byli jsme na Šumavě.')).toBeInTheDocument()
  expect(screen.getByTestId('value')).toHaveTextContent('Byli jsme tam.')
  const sent = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
  expect(sent).toEqual({ action: 'rewrite', field: { label: 'Perex', type: 'TEXT', value: 'Byli jsme tam.' }, context: context() })
  await expectNoA11yViolations(container)
  await userEvent.click(within(panel).getByRole('button', { name: 'Use' }))
  expect(screen.getByTestId('value')).toHaveTextContent('Byli jsme na Šumavě.')
  expect(screen.queryByRole('region', { name: 'AI suggestion for Perex' })).not.toBeInTheDocument()
  expect(container.querySelector('#field-perex')).toHaveAttribute('data-version', '1')
})

it('asks for a brief before a draft and sends it as the instruction', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(sse([delta('Nový text'), done()]))
  renderWithProviders(<Harness field={perex} initial="" />)
  await userEvent.click(await screen.findByRole('button', { name: 'AI for Perex' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Write a draft' }))
  await userEvent.type(screen.getByLabelText('What should AI write?'), 'o výletu na Šumavu')
  await userEvent.click(screen.getByRole('button', { name: 'Create' }))
  expect(await screen.findByText('Nový text')).toBeInTheDocument()
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ action: 'draft', instruction: 'o výletu na Šumavu' })
})

it('cleans rich text and can insert it below the current text', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(sse([delta('<p>Druhý <strong>odstavec</strong></p><script>alert(1)</script>'), done()]))
  renderWithProviders(<Harness field={body} initial="<p>První</p>" />)
  await userEvent.click(await screen.findByRole('button', { name: 'AI for Body' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Expand' }))
  const panel = await screen.findByRole('region', { name: 'AI suggestion for Body' })
  await within(panel).findByText('odstavec')
  expect(panel.querySelector('script')).toBeNull()
  await userEvent.click(within(panel).getByRole('button', { name: 'Insert below' }))
  expect(screen.getByTestId('value').textContent).toBe('<p>První</p><p>Druhý <strong>odstavec</strong></p>')
})

it('aborts the request on Discard and shows nothing more', async () => {
  let release: () => void = () => {}
  const hold = new Promise<void>((resolve) => (release = resolve))
  let signal: AbortSignal | undefined
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    signal = init?.signal ?? undefined
    return sse([delta('Začátek')], hold)
  })
  renderWithProviders(<Harness field={perex} initial="Byli jsme tam." />)
  await userEvent.click(await screen.findByRole('button', { name: 'AI for Perex' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Shorten' }))
  const panel = await screen.findByRole('region', { name: 'AI suggestion for Perex' })
  await within(panel).findByText('Začátek')
  await userEvent.click(within(panel).getByRole('button', { name: 'Discard' }))
  expect(signal?.aborted).toBe(true)
  release()
  await waitFor(() => expect(screen.queryByRole('region')).not.toBeInTheDocument())
  expect(screen.getByTestId('value')).toHaveTextContent('Byli jsme tam.')
})

it('explains errors, links to the settings for key problems, and can retry', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(sse(['event: error\ndata: {"code":"AUTH","message":"The AI service refused the key"}\n\n'])).mockResolvedValueOnce(sse([delta('Opraveno'), done()]))
  renderWithProviders(<Harness field={perex} initial="Byli jsme tam." />)
  await userEvent.click(await screen.findByRole('button', { name: 'AI for Perex' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Fix spelling and grammar' }))
  const panel = await screen.findByRole('region', { name: 'AI suggestion for Perex' })
  expect(await within(panel).findByRole('alert')).toHaveTextContent('The AI service refused the key.')
  expect(within(panel).getByRole('link', { name: 'AI assistant settings' })).toHaveAttribute('href', '/account/ai')
  await userEvent.click(within(panel).getByRole('button', { name: 'Try again' }))
  expect(await within(panel).findByText('Opraveno')).toBeInTheDocument()
})

it('warns when the answer was cut off', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(sse([delta('Dlouhý'), done(',"truncated":true')]))
  renderWithProviders(<Harness field={perex} initial="x" />)
  await userEvent.click(await screen.findByRole('button', { name: 'AI for Perex' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Expand' }))
  expect(await screen.findByText('The answer was cut off at the length limit.')).toBeInTheDocument()
})

it('shows no AI button when AI is not ready', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: { ...ready, connection: null } } })
  renderWithProviders(<Harness field={perex} initial="x" />)
  await screen.findByLabelText('Perex')
  await waitFor(() => expect(apiClient.get).toHaveBeenCalled())
  expect(screen.queryByRole('button', { name: 'AI for Perex' })).not.toBeInTheDocument()
})

it('renders in Czech', async () => {
  await setTestLanguage('cs')
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(sse([delta('Kratší'), done()]))
  renderWithProviders(<Harness field={perex} initial="Byli jsme tam." />)
  await userEvent.click(await screen.findByRole('button', { name: 'AI pro Perex' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Zkrátit' }))
  const panel = await screen.findByRole('region', { name: 'Návrh AI pro Perex' })
  await within(panel).findByText('Kratší')
  expect(within(panel).getByRole('button', { name: 'Použít' })).toBeInTheDocument()
  expect(within(panel).getByRole('button', { name: 'Zahodit' })).toBeInTheDocument()
})

it('never submits the surrounding editor form from the instruction box', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(sse([delta('Nový text'), done()]))
  const submitted = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
  renderWithProviders(
    <form onSubmit={submitted}>
      <Harness field={perex} initial="" />
    </form>,
  )
  await userEvent.click(await screen.findByRole('button', { name: 'AI for Perex' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Write a draft' }))
  await userEvent.type(screen.getByLabelText('What should AI write?'), 'o výletu')
  await userEvent.click(screen.getByRole('button', { name: 'Create' }))
  expect(await screen.findByText('Nový text')).toBeInTheDocument()
  expect(submitted).not.toHaveBeenCalled()
  expect(screen.getByRole('region', { name: 'AI suggestion for Perex' }).querySelector('form')).toBeNull()
})
