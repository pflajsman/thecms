import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Inbox } from 'lucide-react'
import { StatusPill } from './StatusPill'
import { EmptyState } from './EmptyState'
import { PageHeader } from './PageHeader'
import { ConfirmDialog } from './ConfirmDialog'
import { setTestLanguage } from '@/test/render'

describe('StatusPill', () => {
  it.each([
    ['PUBLISHED', 'Published'],
    ['DRAFT', 'Draft'],
    ['ARCHIVED', 'Archived'],
    ['UNREAD', 'New'],
    ['READ', 'Read'],
  ] as const)('renders %s as %s', (status, label) => {
    render(<StatusPill status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})

describe('EmptyState and PageHeader', () => {
  it('renders title, description and action', () => {
    render(<EmptyState icon={Inbox} title="No messages" description="Nothing yet." action={<button>Create</button>} />)
    expect(screen.getByRole('status')).toHaveTextContent('No messages')
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
  })
  it('renders the page title as h1', () => {
    render(<PageHeader title="Content" actions={<button>New</button>} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Content' })).toBeInTheDocument()
  })
})

describe('ConfirmDialog', () => {
  it('confirms a simple action', async () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog open onOpenChange={() => {}} title="Archive entry?" description="You can restore it later." onConfirm={onConfirm} confirmLabel="Archive" />)
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('requires typing the exact confirm text', async () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog open onOpenChange={() => {}} title="Delete model?" description="This deletes 8 entries." confirmText="Trip" confirmLabel="Delete" destructive onConfirm={onConfirm} />)
    const confirm = screen.getByRole('button', { name: 'Delete' })
    expect(confirm).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/type/i), 'trip')
    expect(confirm).toBeDisabled()
    await userEvent.clear(screen.getByLabelText(/type/i))
    await userEvent.type(screen.getByLabelText(/type/i), 'Trip')
    expect(confirm).toBeEnabled()
    await userEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})

it('shows statuses and dialog buttons in Czech', async () => {
  await setTestLanguage('cs')
  render(<StatusPill status="DRAFT" />)
  expect(screen.getByText('Koncept')).toBeInTheDocument()
  render(<ConfirmDialog open onOpenChange={() => {}} title="x" description="y" onConfirm={() => {}} />)
  expect(screen.getByRole('button', { name: 'Zrušit' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Potvrdit' })).toBeInTheDocument()
})
