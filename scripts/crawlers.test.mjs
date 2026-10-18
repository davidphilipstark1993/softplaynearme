import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const robots = fs.readFileSync(path.join(ROOT, 'app/robots.ts'), 'utf8')

test('robots.ts names every AI crawler we want to allow', () => {
  for (const bot of ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended']) {
    assert.ok(new RegExp(`'${bot}'`).test(robots), `${bot} missing`)
  }
})

test('robots.ts: named group repeats the private-path rules and a Sitemap is declared', () => {
  assert.match(robots, /userAgent: AI_CRAWLERS, allow: '\/', disallow: PRIVATE_PATHS/)
  assert.match(robots, /userAgent: '\*', allow: '\/', disallow: PRIVATE_PATHS/)
  assert.match(robots, /sitemap: `\$\{SITE\}\/sitemap\.xml`/)
  for (const p of ['/api/', '/admin/', '/dashboard/', '/verify-email/']) assert.ok(robots.includes(`'${p}'`))
})

test('sitemap: no lastmod of "now" for content pages', () => {
  const sitemap = fs.readFileSync(path.join(ROOT, 'app/sitemap.ts'), 'utf8')
  assert.doesNotMatch(sitemap, /lastModified:\s*new Date\(\)/)
  assert.doesNotMatch(sitemap, /\|\|\s*new Date\(\)/)
})
