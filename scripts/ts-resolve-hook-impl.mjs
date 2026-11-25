import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Repo root, for the "@/..." alias that tsconfig.json maps to "./*".
const ROOT = new URL('../', import.meta.url)

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) specifier = new URL(specifier.slice(2), ROOT).href
  const relative = specifier.startsWith('./') || specifier.startsWith('../')
  if ((relative || specifier.startsWith('file:')) && !/\.\w+$/.test(specifier) && (context.parentURL || !relative)) {
    const candidate = new URL(`${specifier}.ts`, relative ? context.parentURL : undefined)
    if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context)
  }
  // lib/ files import JSON the bundler way (no `with { type: 'json' }`); Node needs the attribute.
  if (/\.json$/.test(specifier)) {
    const resolved = await nextResolve(specifier, context)
    return { ...resolved, importAttributes: { ...resolved.importAttributes, type: 'json' } }
  }
  return nextResolve(specifier, context)
}
