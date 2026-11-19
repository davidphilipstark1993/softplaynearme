/** Server-side helpers for the owner session cookie (see lib/claims/tokens.ts). */
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { readSessionValue, SESSION_COOKIE } from './tokens'
import { getClaim, type Claim } from './db'
import { venuePathsFor } from './paths'

/** The signed-in owner's claim, or null. */
export async function getSessionClaim(): Promise<Claim | null> {
  const id = readSessionValue((await cookies()).get(SESSION_COOKIE)?.value)
  if (!id) return null
  try {
    return await getClaim(id)
  } catch {
    return null
  }
}


export function revalidateVenue(citySlug: string | null | undefined, slug: string | null | undefined): string[] {
  if (!citySlug || !slug) return []
  const paths = venuePathsFor(citySlug, slug)
  for (const p of paths) revalidatePath(p)
  return paths
}
