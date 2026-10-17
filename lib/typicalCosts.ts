/**
 * UK-wide "typical" figures for soft play, used as a clearly labelled guide where
 * a city or venue has no published figure of its own. They are NOT venue data and
 * are never shown as one: every sentence says it is a UK-wide guide and gives the
 * month it was researched, and per-venue/per-city numbers from the listings always
 * take precedence (see lib/cityContent.ts).
 *
 * Researched October 2026 from prices and opening times published by UK venues:
 *   Session prices  Plymouth National Marine Aquarium £2 (weekends/holidays, 1h);
 *                   Dorset Playzone £4 (£2.90 extra child); Whitley Bay café
 *                   £3.25–£6 (1h45); Lancaster Energy £6; Brixton Rec £8.05 (under 4)
 *                   and £10.30 (under 8); Stoke SEN session £7.50. Our own listings
 *                   with a published price: £4.00, £4.40, £7.50–£9.00, £8.95–£11.95.
 *   Party prices    Antrim Valley Leisure £6; Bewl Water £7 (£12 hosted); Tenpin
 *                   £10.20 (6+ children, meal included); Darlington £12.99; Play
 *                   Botwell Green £135 for 10 (then £13.50 each); exclusive hire
 *                   £190–£270 (Hillingdon £190, Bewl Water £195/£270).
 *   Opening hours   Published hours at BH Live (9–6 weekdays, 9–5:30 weekends),
 *                   Activecentres (9–5), Keynsham (9–6, Fri 9–4), Clip 'n Climb
 *                   (10–5 weekdays, 10–4:30 weekends). Across our own listings
 *                   (~2,400 weekday entries) the median is 9:30am–5:30pm; the middle
 *                   half open 9:00–9:30am and close 3:15–6:00pm.
 * Re-run that research and update RESEARCHED when you refresh the figures.
 */
export const RESEARCHED = 'October 2026'

export const TYPICAL = {
  sessionLow: 4,
  sessionHigh: 8,
  partyLow: 10,
  partyHigh: 14,
  exclusiveHireLow: 135,
  exclusiveHireHigh: 270,
  weekdayOpen: '9:30am',
  weekdayClose: '5:30pm',
} as const

/** Play-session cost guide. */
export const TYPICAL_SESSION_SENTENCE =
  `As a UK-wide guide (published venue prices, checked ${RESEARCHED}), a play session typically costs about £${TYPICAL.sessionLow}–£${TYPICAL.sessionHigh} per child. ` +
  `Council and community venues sit at the low end, while London and large commercial centres can charge £8–£10 or more; babies are often free or a few pounds.`

/** Birthday-party cost guide. */
export const TYPICAL_PARTY_SENTENCE =
  `As a UK-wide guide (published venue prices, checked ${RESEARCHED}), a soft play party typically costs about £${TYPICAL.partyLow}–£${TYPICAL.partyHigh} per child, ` +
  `usually with a minimum of 6–10 children and sometimes food extra. Hiring a whole play area exclusively is usually a flat £${TYPICAL.exclusiveHireLow}–£${TYPICAL.exclusiveHireHigh}.`

/** Opening-hours guide. */
export const TYPICAL_HOURS_SENTENCE =
  `As a guide, most soft play centres open around ${TYPICAL.weekdayOpen} on weekdays and close around ${TYPICAL.weekdayClose} (across our listings the middle half open 9:00–9:30am and close between 3:15pm and 6:00pm). ` +
  `Weekend and school-holiday hours differ, and many close early for private parties.`
