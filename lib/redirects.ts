/**
 * Permanent redirects for moved, renamed, merged and retired venue URLs.
 *
 * data/redirects.json is the one list every migration writes to. It is served by
 * proxy.ts (not next.config redirects): a Map lookup scales to thousands of entries
 * without adding a route per entry to the build, and Vercel caps a deployment's
 * routes at 2048.
 *
 * Chains are flattened when the map is built, so every old URL answers with a single
 * 301 to its final page even if two migrations touched it.
 */
import entries from '@/data/redirects.json'

type Entry = { source: string; destination: string }

const raw = new Map((entries as Entry[]).map((e) => [e.source, e.destination]))

function finalDestination(source: string): string | null {
  const seen = new Set([source])
  let dest = raw.get(source)
  while (dest && raw.has(dest)) {
    if (seen.has(dest)) return null // loop: refuse rather than bounce forever
    seen.add(dest)
    dest = raw.get(dest)
  }
  return dest ?? null
}

/** source path -> final destination path, chains already collapsed. */
export const REDIRECTS: ReadonlyMap<string, string> = new Map(
  [...raw.keys()]
    .map((s) => [s, finalDestination(s)] as const)
    .filter((pair): pair is readonly [string, string] => !!pair[1] && pair[1] !== pair[0]),
)

const stripSlash = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p)

/** Where this path permanently lives now, or null if it is not redirected. */
export function redirectFor(pathname: string): string | null {
  return REDIRECTS.get(stripSlash(pathname)) ?? null
}

let reverse: Map<string, string[]> | null = null

/**
 * Old paths that redirect to `destination`. Used by the venue page as a bridge for a
 * move whose redirect is deployed before the DB row is updated: the new URL renders
 * the venue from its old row instead of 404ing, so deploy and migration can happen
 * in either order.
 */
export function pendingSources(destination: string): string[] {
  if (!reverse) {
    reverse = new Map()
    for (const [s, d] of REDIRECTS) (reverse.get(d) ?? reverse.set(d, []).get(d)!).push(s)
  }
  return reverse.get(stripSlash(destination)) ?? []
}
