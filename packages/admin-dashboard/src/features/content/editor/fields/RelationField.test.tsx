import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import * as api from '../../content-api'
import * as languagesApi from '@/features/languages/languages-api'
import { makeListItem, page } from '../../test-fixtures'
import { RelationField } from './RelationField'

vi.mock('../../content-api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../content-api')>()), listEntries: vi.fn(), getEntry: vi.fn() }))
vi.mock('@/features/languages/languages-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/languages/languages-api')>()),
  listLanguages: vi.fn(),
}))

const field = { name: 'related', label: 'Related', type: 'RELATION' as const, required: false, validation: { multiple: true } }

it('lists one row per item, in the default language, and stores the item id', async () => {
  vi.mocked(languagesApi.listLanguages).mockResolvedValue([
    { id: 'l1', code: 'en', name: 'English', isDefault: true, order: 0 },
    { id: 'l2', code: 'cs', name: 'Čeština', isDefault: false, order: 1 },
  ])
  vi.mocked(api.listEntries).mockResolvedValue(
    page([
      makeListItem({ id: 'cs1', itemId: 'en1', language: 'cs', title: 'Přes kopce' }),
      makeListItem({ id: 'en1', itemId: 'en1', language: 'en', title: 'Over the hills' }),
      makeListItem({ id: 'x1', itemId: 'x1', language: 'cs', title: 'Jen česky' }),
    ]),
  )
  const onChange = vi.fn()
  renderWithProviders(<RelationField field={field} id="field-related" value={[]} onChange={onChange} onBlur={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: 'Related' }))
  const options = await screen.findAllByRole('option')
  expect(options.map((o) => o.textContent)).toEqual([expect.stringContaining('Over the hills'), expect.stringContaining('Jen česky')])
  await userEvent.click(options[0])
  expect(onChange).toHaveBeenCalledWith(['en1'])
})
