import { optionKey } from './option-keys'

it('makes unique keys of at most 40 characters even when long labels share their start', () => {
  const label = 'Extra large premium organic cotton blend edition'
  const first = optionKey(`${label} one`, [])
  const second = optionKey(`${label} two`, [first])
  expect(first.length).toBeLessThanOrEqual(40)
  expect(second.length).toBeLessThanOrEqual(40)
  expect(second).not.toBe(first)
  expect(second).toMatch(/^[a-z][a-z0-9-]*[a-z0-9]$/)
})
