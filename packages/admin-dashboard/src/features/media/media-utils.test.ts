import { formatBytes, isImage, matchesAccept, mediaCategory, originalUrl, previewUrl, validateUpload } from './media-utils'
import { makeMedia } from './test-fixtures'

const file = (name: string, type: string, size = 1000) => new File([new Uint8Array(size)], name, { type })

describe('mediaCategory', () => {
  it.each([
    ['image/png', 'x.png', 'image'],
    ['video/mp4', 'x.mp4', 'video'],
    ['application/pdf', 'x.pdf', 'document'],
    ['application/gpx+xml', 'x.gpx', 'gpx'],
    ['application/octet-stream', 'ride.GPX', 'gpx'],
  ])('%s %s is %s', (mimeType, originalName, expected) => {
    expect(mediaCategory({ mimeType, originalName })).toBe(expected)
  })
})

describe('previewUrl and originalUrl', () => {
  it('prefers the requested variant, then the thumbnail, then the original image', () => {
    const m = makeMedia()
    expect(previewUrl(m, 'small')).toBe('http://blob/media/a1b2-sumava-small.jpg')
    expect(previewUrl(m, 'large')).toBe('http://blob/media/a1b2-sumava-thumbnail.jpg')
    expect(previewUrl(makeMedia({ variants: [], thumbnailUrl: undefined }), 'small')).toBe('http://blob/media/a1b2-sumava.jpg')
  })
  it('has no preview for documents', () => {
    expect(previewUrl(makeMedia({ mimeType: 'application/pdf', variants: [], thumbnailUrl: undefined }))).toBeUndefined()
  })
  it('uses the CDN URL when present', () => {
    expect(originalUrl(makeMedia({ cdnUrl: 'https://cdn/a.jpg' }))).toBe('https://cdn/a.jpg')
    expect(isImage(makeMedia())).toBe(true)
  })
})

describe('formatBytes', () => {
  it.each([[512, '512 B'], [2048, '2 KB'], [245_000, '239 KB'], [5_500_000, '5.2 MB']])('%d is %s', (n, s) => {
    expect(formatBytes(n)).toBe(s)
  })
})

describe('validateUpload', () => {
  it('accepts supported files up to 10 MB', () => {
    expect(validateUpload(file('a.jpg', 'image/jpeg'))).toBeNull()
    expect(validateUpload(file('ride.gpx', ''))).toBeNull()
  })
  it('rejects large and unsupported files with a message', () => {
    expect(validateUpload(file('big.jpg', 'image/jpeg', 10 * 1024 * 1024 + 1))).toBe('big.jpg is larger than 10 MB.')
    expect(validateUpload(file('run.exe', 'application/x-msdownload'))).toBe('run.exe is not a supported file type.')
  })
})

describe('matchesAccept', () => {
  it('handles wildcards, exact types and the gpx extension', () => {
    const img = { mimeType: 'image/png', originalName: 'a.png' }
    const gpx = { mimeType: 'application/octet-stream', originalName: 'ride.gpx' }
    expect(matchesAccept(img, undefined)).toBe(true)
    expect(matchesAccept(img, ['image/*'])).toBe(true)
    expect(matchesAccept(gpx, ['image/*'])).toBe(false)
    expect(matchesAccept(gpx, ['application/gpx+xml'])).toBe(true)
  })
})
