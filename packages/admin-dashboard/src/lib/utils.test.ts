import { cn } from './utils'

it('merges conflicting Tailwind classes, last wins', () => {
  const hidden = false as boolean
  expect(cn('px-2 text-sm', hidden && 'hidden', 'px-4')).toBe('text-sm px-4')
})
