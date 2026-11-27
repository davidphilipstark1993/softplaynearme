import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

test('no internal / editor notes in public copy', () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'notes-')), 'out.csv')
  execFileSync('node', [path.join(ROOT, 'scripts/find-leaked-notes.mjs'), `--out=${out}`], { cwd: ROOT, stdio: 'pipe' })
  const editorNotes = fs.readFileSync(out, 'utf8').split('\n').filter((l) => l.startsWith('editor_note,'))
  assert.deepEqual(editorNotes, [])
})

test('the city page renders each filter control once, and the newsletter sign-up only via the footer', () => {
  const page = fs.readFileSync(path.join(ROOT, 'app/soft-play/[city]/page.tsx'), 'utf8')
  assert.equal((page.match(/<FilterSidebar/g) ?? []).length, 1)
  assert.equal((page.match(/<NewsletterSignup/g) ?? []).length, 0, 'the footer has the one sign-up')
})

test('newsletter sign-up appears once per page: only the footer, or only the page body on /newsletter', () => {
  const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')
  for (const p of ['app/page.tsx', 'app/soft-play/[city]/[slug]/page.tsx', 'app/blog/[slug]/page.tsx', 'components/search/SearchResults.tsx', 'components/filter/FilterPageContent.tsx']) {
    assert.equal((read(p).match(/<NewsletterSignup/g) ?? []).length, 0, p)
  }
  for (const p of ['app/newsletter/page.tsx', 'app/newsletter/[slug]/page.tsx']) {
    assert.equal((read(p).match(/<NewsletterSignup/g) ?? []).length, 1, p)
    assert.match(read(p), /<Footer newsletter=\{false\} \/>/, p)
  }
})
