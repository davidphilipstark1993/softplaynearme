import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateUkPostcode,
  normalizeUkPostcode,
  extractFacilitiesFromText,
  computePatch,
} from './enrichment-utils.mjs'

test('validateUkPostcode accepts and rejects correctly', () => {
  assert.equal(validateUkPostcode('YO1 7HB'), true)
  assert.equal(validateUkPostcode('SW1A 1AA'), true)
  assert.equal(validateUkPostcode('INVALID'), false)
  assert.equal(validateUkPostcode('12345'), false)
  assert.equal(normalizeUkPostcode('yo17hb'), 'YO1 7HB')
})

test('extractFacilitiesFromText detects deterministic keywords', () => {
  const text = 'We have a cafe, free parking, SEN-friendly quiet sessions, and a toddler zone with role play.'
  const facilities = extractFacilitiesFromText(text)
  assert.deepEqual(
    facilities,
    ['accessibility', 'cafe', 'parking', 'role_play', 'sensory_sessions', 'toddler_zone']
      .filter((k) => facilities.includes(k))
      .sort()
  )
  assert.equal(facilities.includes('cafe'), true)
  assert.equal(facilities.includes('parking'), true)
  assert.equal(facilities.includes('sensory_sessions'), true)
  assert.equal(facilities.includes('toddler_zone'), true)
})

test('computePatch fills blanks and does not overwrite good data', () => {
  const before = {
    description: 'Existing factual description',
    postcode: 'YO1 7HB',
    phone: '+441904111222',
    source_urls: ['https://example.com'],
  }

  const candidate = {
    description: 'New description should not overwrite',
    postcode: 'YO30 1AA',
    phone: '+441904111222',
    email: 'hello@example.com',
    source_urls: ['https://example.com', 'https://maps.example.com'],
  }

  const patch = computePatch(before, candidate)
  assert.equal(patch.description, undefined)
  assert.equal(patch.postcode, undefined)
  assert.equal(patch.email, 'hello@example.com')
  assert.deepEqual(patch.source_urls, ['https://example.com', 'https://maps.example.com'])
})
