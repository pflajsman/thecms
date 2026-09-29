import { maskKey, originError, validateSite } from './sites-utils'

it('masks API keys, keeping the prefix and the last 4 characters', () => {
  expect(maskKey('cms_3pb84HyVsBJaZUynsNSvQLZmdaugcBNVo0XYt16EpWk')).toBe('cms_••••••••EpWk')
  expect(maskKey('short')).toBe('•••••')
})

it('validates allowed origins', () => {
  expect(originError('example.com', [])).toBe('Enter a full URL, for example https://example.com')
  expect(originError('https://example.com/', ['https://example.com'])).toBe('This origin is already in the list')
  expect(originError('http://localhost:5174', [])).toBeNull()
})

it('validates a site', () => {
  expect(validateSite({ name: '', domain: '', allowedOrigins: [] })).toEqual({ name: 'Name is required', domain: 'Domain is required' })
  expect(validateSite({ name: 'Blog', domain: 'blog.test', allowedOrigins: ['nope'] })).toEqual({ allowedOrigins: 'Enter a full URL, for example https://example.com' })
})
