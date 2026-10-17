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

test('the city page renders each filter control once and at most two newsletter sign-ups of its own', () => {
  const page = fs.readFileSync(path.join(ROOT, 'app/soft-play/[city]/page.tsx'), 'utf8')
  assert.equal((page.match(/<FilterSidebar/g) ?? []).length, 1)
  assert.equal((page.match(/<NewsletterSignup/g) ?? []).length, 1, 'one in the page body + the footer = two')
})
