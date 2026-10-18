import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dup-')), 'out.csv')
execFileSync('node', [path.join(ROOT, 'scripts/find-duplicate-venues.mjs'), `--out=${out}`], { cwd: ROOT, stdio: 'pipe' })
const text = fs.readFileSync(out, 'utf8')

test('Active+ Hull / Little Monkeys @ Active+ (same site, same 222 reviews) is a HIGH candidate', () => {
  const line = text.split('\n').find((l) => l.includes('Active+ Hull') && l.includes('Little Monkeys @ Active+'))
  assert.ok(line, 'pair not found')
  assert.ok(line.startsWith('HIGH,'))
  assert.match(line, /same_website/)
  assert.match(line, /same_review_count/)
})

test('the script only reports; it does not touch the data files', () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts/find-duplicate-venues.mjs'), 'utf8')
  assert.doesNotMatch(src, /\b(UPDATE|DELETE|INSERT)\b/)
  assert.doesNotMatch(src, /writeFileSync\((?!outPath)/)
})
