/**
 * Does a claimant's email address belong to the venue's own website domain?
 *
 * Both sides are reduced to their registrable domain ("www.shop.funplex.co.uk" and
 * "info@mail.funplex.co.uk" both become "funplex.co.uk"), so www and subdomains match.
 * Webmail addresses never match, and neither does a website hosted on a shared platform
 * (Facebook, Wix, Simplybook…): anyone can have an address at those domains, so a match
 * there proves nothing. Those claims go to manual review instead.
 */

// Second-level labels under which the registrable domain has three labels (funplex.co.uk).
const MULTI_PART_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'me.uk', 'ltd.uk', 'plc.uk', 'net.uk', 'sch.uk', 'ac.uk', 'gov.uk', 'nhs.uk', 'police.uk',
  'com.au', 'net.au', 'org.au', 'co.nz', 'org.nz', 'co.za', 'co.ie', 'com.cy',
])

export const WEBMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'outlook.co.uk', 'live.com',
  'live.co.uk', 'msn.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'rocketmail.com', 'icloud.com', 'me.com',
  'mac.com', 'aol.com', 'aol.co.uk', 'btinternet.com', 'btopenworld.com', 'sky.com', 'talktalk.net',
  'virginmedia.com', 'ntlworld.com', 'blueyonder.co.uk', 'tiscali.co.uk', 'protonmail.com', 'proton.me',
  'gmx.com', 'gmx.co.uk', 'mail.com', 'zoho.com', 'yandex.com', 'hey.com', 'fastmail.com',
])

// Website hosts shared by many businesses: a venue "website" here doesn't identify the owner.
export const PLATFORM_DOMAINS = new Set([
  'facebook.com', 'fb.com', 'instagram.com', 'tiktok.com', 'linktr.ee', 'wixsite.com', 'wix.com', 'square.site',
  'squarespace.com', 'weebly.com', 'wordpress.com', 'blogspot.com', 'godaddysites.com', 'business.site',
  'google.com', 'simplybook.me', 'simplybook.it', 'bookwhen.com', 'eventbrite.co.uk', 'eventbrite.com',
  'ticketsource.co.uk', 'setmore.com', 'fresha.com', 'yell.com', 'webs.com', 'jimdosite.com', 'ueniweb.com',
  'yolasite.com', 'carrd.co', 'github.io', 'netlify.app', 'vercel.app', 'myshopify.com',
])

/** Host of a URL or bare domain, lower-cased, without port. Null when it isn't one. */
export function hostOf(input: string | null | undefined): string | null {
  const raw = String(input ?? '').trim().toLowerCase()
  if (!raw) return null
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//.test(raw) ? raw : `https://${raw}`)
    const host = u.hostname.replace(/\.$/, '')
    return host.includes('.') ? host : null
  } catch {
    return null
  }
}

/** "www.shop.funplex.co.uk" -> "funplex.co.uk"; "a.b.example.com" -> "example.com". */
export function registrableDomain(host: string | null | undefined): string | null {
  if (!host) return null
  const labels = host.toLowerCase().replace(/^www\./, '').split('.').filter(Boolean)
  if (labels.length < 2) return null
  const lastTwo = labels.slice(-2).join('.')
  if (MULTI_PART_SUFFIXES.has(lastTwo)) return labels.length >= 3 ? labels.slice(-3).join('.') : null
  return lastTwo
}

export function emailDomain(email: string | null | undefined): string | null {
  const m = String(email ?? '').trim().toLowerCase().match(/^[^\s@]+@([^\s@]+\.[^\s@]+)$/)
  return m ? m[1] : null
}

export function isWebmail(email: string | null | undefined): boolean {
  const d = emailDomain(email)
  return !!d && WEBMAIL_DOMAINS.has(d)
}

export type DomainCheck = { match: true; domain: string } | { match: false; reason: 'webmail' | 'no-website' | 'platform-website' | 'different-domain' | 'invalid-email' }

/** The verification decision for an email against a venue website URL. */
export function checkEmailAgainstWebsite(email: string, website: string | null | undefined): DomainCheck {
  const ed = emailDomain(email)
  if (!ed) return { match: false, reason: 'invalid-email' }
  if (WEBMAIL_DOMAINS.has(ed)) return { match: false, reason: 'webmail' }
  const siteHost = hostOf(website)
  const site = registrableDomain(siteHost)
  if (!site) return { match: false, reason: 'no-website' }
  if (PLATFORM_DOMAINS.has(site)) return { match: false, reason: 'platform-website' }
  const mail = registrableDomain(ed)
  return mail && mail === site ? { match: true, domain: site } : { match: false, reason: 'different-domain' }
}
