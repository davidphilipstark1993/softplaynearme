// Search input handling and analytics privacy (Phase 6).
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerTsResolver } from './ts-resolve-hook.mjs'

const canStripTypes = process.features.typescript !== false && Number(process.versions.node.split('.')[0]) >= 22
registerTsResolver()
const skip = canStripTypes ? false : 'needs Node >= 22.18 (built-in TypeScript type stripping)'

test('analytics gets a postcode district, never a full postcode', { skip }, async () => {
  const { searchTermForAnalytics } = await import('../lib/gtag.ts')
  assert.equal(searchTermForAnalytics('HU5 3AB'), 'HU5')
  assert.equal(searchTermForAnalytics(' sw1a1aa '), 'SW1A')
  assert.equal(searchTermForAnalytics('M1 1AE'), 'M1')
  assert.equal(searchTermForAnalytics('HU5'), 'hu5')
  assert.equal(searchTermForAnalytics('  Jungle Jims '), 'jungle jims')
  assert.equal(searchTermForAnalytics('x'.repeat(100)).length, 60)
})

test('postcode districts are told apart from full postcodes and place names', { skip }, async () => {
  const { isUKOutcode, isValidUKPostcode } = await import('../lib/geo.ts')
  for (const ok of ['HU5', 'sw1a', 'M1', 'EC1V', 'B33']) assert.ok(isUKOutcode(ok), ok)
  for (const no of ['HU5 3AB', 'Hull', 'jungle', '123', 'HU']) assert.ok(!isUKOutcode(no), no)
  assert.ok(isValidUKPostcode('HU5 3AB'))
  assert.ok(!isValidUKPostcode('HU5'))
})
