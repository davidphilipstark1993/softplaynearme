import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { registerTsResolver } from './ts-resolve-hook.mjs'

const canStripTypes = Number(process.versions.node.split('.')[0]) >= 22
registerTsResolver()
const skip = canStripTypes ? false : 'needs Node >= 22.18 (built-in TypeScript type stripping)'

const { withUtm } = await import('../lib/ads/utm.ts').catch(() => ({}))
const { adInputSchema } = await import('../lib/ads/validation.ts').catch(() => ({}))
const { processAdImage, ImageError } = await import('../lib/ads/image.ts').catch(() => ({}))
const { isBotUserAgent, cleanPath, rateLimit } = await import('../lib/ads/guards.ts').catch(() => ({}))

const base = {
  title: 'Listen True Crime', description: 'Podcast', ctaText: 'Listen now',
  destinationUrl: 'https://listentruecrime.com', imageUrl: null, imageAlt: '',
  advertiserName: 'LTC', advertiserType: 'house', utmCampaign: '', status: 'draft',
  startsAt: null, endsAt: null, priority: 5, placements: ['city_page'], citySlugs: [],
}

test('UTM identifies Soft Play Near Me as the source', { skip }, () => {
  const u = new URL(withUtm('https://listentruecrime.com', { placement: 'city_page', title: 'Listen True Crime', advertiserType: 'house' }))
  assert.equal(u.searchParams.get('utm_source'), 'softplaynearme')
  assert.equal(u.searchParams.get('utm_medium'), 'cross_promo')
  assert.equal(u.searchParams.get('utm_campaign'), 'listen-true-crime')
  assert.equal(u.searchParams.get('utm_content'), 'city_page')
})

test('UTM keeps existing params and an advertiser\'s own utm_*', { skip }, () => {
  const u = new URL(withUtm('https://x.com/p?ref=a&utm_source=mine', { placement: 'blog_post', title: 'T', advertiserType: 'sponsor', campaign: 'spring' }))
  assert.equal(u.searchParams.get('ref'), 'a')
  assert.equal(u.searchParams.get('utm_source'), 'mine')
  assert.equal(u.searchParams.get('utm_medium'), 'sponsored')
  assert.equal(u.searchParams.get('utm_campaign'), 'spring')
})

test('validation: accepts a draft, rejects javascript: URLs and bad dates', { skip }, () => {
  assert.ok(adInputSchema.safeParse(base).success)
  assert.ok(!adInputSchema.safeParse({ ...base, destinationUrl: 'javascript:alert(1)' }).success)
  assert.ok(!adInputSchema.safeParse({ ...base, startsAt: '2026-12-02T00:00:00Z', endsAt: '2026-12-01T00:00:00Z' }).success)
  assert.ok(!adInputSchema.safeParse({ ...base, placements: ['nope'] }).success)
})

test('validation: cannot activate without artwork or placement; images must be our Blob store', { skip }, () => {
  assert.ok(!adInputSchema.safeParse({ ...base, status: 'active' }).success)
  assert.ok(!adInputSchema.safeParse({ ...base, status: 'active', placements: [], imageUrl: 'https://abc.public.blob.vercel-storage.com/ads/a.webp', imageAlt: 'x' }).success)
  assert.ok(!adInputSchema.safeParse({ ...base, imageUrl: 'https://evil.example/a.png', imageAlt: 'x' }).success)
  assert.ok(!adInputSchema.safeParse({ ...base, imageUrl: 'https://abc.public.blob.vercel-storage.com/ads/a.webp', imageAlt: '' }).success)
  assert.ok(adInputSchema.safeParse({ ...base, status: 'active', imageUrl: 'https://abc.public.blob.vercel-storage.com/ads/a.webp', imageAlt: 'x' }).success)
})

test('"all" collapses other placements', { skip }, () => {
  assert.deepEqual(adInputSchema.parse({ ...base, placements: ['city_page', 'all'] }).placements, ['all'])
})

test('image: any aspect becomes 1280x720 WebP, flags cropping', { skip }, async () => {
  const wide = await sharp({ create: { width: 1600, height: 900, channels: 3, background: '#a0f' } }).png().toBuffer()
  const square = await sharp({ create: { width: 1000, height: 1000, channels: 3, background: '#0af' } }).jpeg().toBuffer()
  const a = await processAdImage(wide)
  const b = await processAdImage(square)
  for (const r of [a, b]) {
    const m = await sharp(r.buffer).metadata()
    assert.equal(m.format, 'webp'); assert.equal(m.width, 1280); assert.equal(m.height, 720)
  }
  assert.equal(a.cropped, false); assert.equal(b.cropped, true)
})

test('image: rejects non-images, SVG, GIF and tiny images', { skip }, async () => {
  await assert.rejects(processAdImage(Buffer.from('<?php echo 1;')), ImageError)
  await assert.rejects(processAdImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="500"><rect width="9" height="9"/></svg>')), ImageError)
  const gif = await sharp({ create: { width: 800, height: 450, channels: 3, background: '#000' } }).gif().toBuffer()
  await assert.rejects(processAdImage(gif), ImageError)
  const tiny = await sharp({ create: { width: 300, height: 170, channels: 3, background: '#000' } }).png().toBuffer()
  await assert.rejects(processAdImage(tiny), ImageError)
})

test('request guards', { skip }, () => {
  assert.ok(isBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1)'))
  assert.ok(isBotUserAgent(null))
  assert.ok(!isBotUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'))
  assert.equal(cleanPath('//evil.com'), null)
  assert.equal(cleanPath('/soft-play/hull?x=1'), '/soft-play/hull')
  assert.ok(rateLimit('t', 2) && rateLimit('t', 2) && !rateLimit('t', 2))
})
