/**
 * Drops sentences from a hub's "About soft play in X" intro that claim what the hub's own
 * data contradicts (Phase 2E, 27 Nov 2026). The audit found 110 hubs whose intro said
 * venues run SEN/quiet sessions while the FAQ on the same page said none are marked
 * SEN-friendly, 29 that promised toddler areas none were confirmed to have, and 20 that
 * quoted a local "expect to pay £6–£11" with no prices held.
 *
 * This only removes; it never writes new copy (rewriting the intros is the separate city
 * intro work). A sentence is kept unless it makes one of these claims AND the data says no.
 */
export interface ClaimStats {
  sen: number
  toddler: number
  baby: number
  parties: number
  withPrice: number
}

const CLAIMS: Array<{ re: RegExp; unsupported: (s: ClaimStats) => boolean }> = [
  { re: /\b(SEN|SEND|sensory|quiet|relaxed|autism[- ]friendly|additional needs)\b[^.]*\b(sessions?|hours|times|mornings|rooms?|friendly|provision|options)\b|\bsensory rooms?\b/i, unsupported: (s) => s.sen === 0 },
  { re: /\b(dedicated|separate|specific)\s+(toddler|under-?\s?\d+s?|baby)\b|\btoddler (areas|zones|sessions)\b|\bunder-?\s?[1-4]s areas?\b/i, unsupported: (s) => s.toddler === 0 && s.baby === 0 },
  { re: /\bbabies,? toddlers,? and older children\b|\bevery age group\b/i, unsupported: (s) => s.toddler === 0 && s.baby === 0 },
  { re: /\bparty packages?\b|\bparties? (are )?(available )?from (around )?£|\bbirthday part(y|ies)[^.]*£/i, unsupported: (s) => s.parties === 0 },
  // A local price claim; the labelled UK-wide guide ("As a UK-wide guide…") is fine.
  { re: /£\s?\d/, unsupported: (s) => s.withPrice === 0 },
]

function sentences(p: string): string[] {
  return p.split(/(?<=[.!?])\s+(?=[A-Z£])/)
}

export function dropUnsupportedClaims(intro: string, stats: ClaimStats): string {
  return intro
    .split('\n\n')
    .map((para) =>
      sentences(para)
        .filter((s) => {
          if (/UK-wide guide|council and community venues sit at the low end/i.test(s)) return true
          return !CLAIMS.some((c) => c.re.test(s) && c.unsupported(stats))
        })
        .join(' '),
    )
    .filter((p) => p.trim())
    .join('\n\n')
}
