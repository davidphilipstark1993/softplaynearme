/**
 * Per-filter content configuration: FAQs, advice tips, and styling.
 * Used by the shared FilterPageContent component.
 */

import { TYPICAL_PARTY_SENTENCE, TYPICAL_HOURS_SENTENCE } from './typicalCosts'

export type FilterSlug = 'toddler' | 'birthday-parties' | 'sen-friendly' | 'open-now'

export interface FilterAdvice {
  heading: string
  tips: string[]
}

export interface FilterContentConfig {
  /** Tailwind gradient classes for the hero banner */
  heroGradient: string
  /** Tailwind classes for the primary feature badge */
  badgeClasses: string
  /** Heading used above the FAQ list */
  faqHeading: string
  faqs: (cityName: string) => { question: string; answer: string }[]
  advice: (cityName: string) => FilterAdvice
}

const filterContentMap: Record<FilterSlug, FilterContentConfig> = {
  toddler: {
    heroGradient: 'from-blue-500 to-cyan-400',
    badgeClasses: 'bg-blue-50 border-blue-200 text-blue-700',
    faqHeading: 'Toddler Soft Play FAQs',
    faqs: (cityName) => [
      {
        question: `What age is the toddler area at soft play in ${cityName}?`,
        answer: `Each venue sets its own limit, but toddler areas are usually for children under about 4: soft mats, low slides and ball pits, kept apart from the main frame. Where a venue in ${cityName} publishes an age range, its page shows it.`,
      },
      {
        question: `Are babies welcome at soft play in ${cityName}?`,
        answer: `Babies are welcome at soft play, but only some venues have a separate baby area. The venues on this page show a baby area where one is confirmed, and their pages show any under-1s prices we hold, as these vary from venue to venue.`,
      },
      {
        question: `Do toddler soft play centres in ${cityName} have cafes?`,
        answer: `Each venue on this page shows a café where one is confirmed. Rules on bringing your own food differ between venues, so check the venue page or ask before you go.`,
      },
      {
        question: `When is the best time to visit toddler soft play in ${cityName}?`,
        answer: `Term-time weekdays, when older children are at school, are usually calmer than weekends and school holidays. Some venues in ${cityName} run toddler-only sessions; ask the venue, or check its page, for current times.`,
      },
    ],
    advice: (cityName) => ({
      heading: `Tips for Visiting Toddler Soft Play in ${cityName}`,
      tips: [
        'Term-time weekdays are usually calmer than weekends and school holidays; ask whether the venue runs toddler-only sessions.',
        'Look for venues with a physically separated toddler area so bigger children on the main frame don\'t overwhelm little ones.',
        'Pack socks for everyone: most soft play centres ask for them, for adults on the frame too.',
        'Check whether the venue has a cafe before you go. Some allow you to bring your own snacks and a flask of tea.',
        'Check the session length when you book or arrive, as venues set different time limits.',
      ],
    }),
  },

  'birthday-parties': {
    heroGradient: 'from-pink-500 to-rose-400',
    badgeClasses: 'bg-pink-50 border-pink-200 text-pink-700',
    faqHeading: 'Birthday Party FAQs',
    faqs: (cityName) => [
      {
        question: `How much do soft play birthday parties cost in ${cityName}?`,
        answer: `Party prices are set by each venue and vary by package, day and number of children, so ask the venues you like in ${cityName} for a current quote. ${TYPICAL_PARTY_SENTENCE}`,
      },
      {
        question: `How far in advance should I book a soft play party in ${cityName}?`,
        answer: `Book as early as you can, especially for weekend slots and school holidays, when party slots tend to go first. Lead times are set by each venue, so ask the ${cityName} venues you like how far ahead they take bookings.`,
      },
      {
        question: `What is included in a soft play birthday party package?`,
        answer: `Packages differ between venues, so check what is included. Common items are a set amount of play time, a party room for the food, children's food and drinks, and sometimes party bags or a party host.`,
      },
      {
        question: `Can parents stay during a soft play birthday party?`,
        answer: `Parents and carers usually stay to supervise, and venues expect them to. Ask whether adult drinks are included in the package or charged separately.`,
      },
      {
        question: `Can I bring my own cake to a soft play party?`,
        answer: `Each venue sets its own cake policy, so ask when you book. Some sell their own cakes as an add-on, and some charge for cutting and serving a cake you bring.`,
      },
    ],
    advice: (cityName) => ({
      heading: `How to Plan a Soft Play Birthday Party in ${cityName}`,
      tips: [
        'Book early for weekends and school holidays, and ask each venue how far ahead it takes bookings.',
        'Ask explicitly whether the party room is exclusively yours or shared — this varies between venues.',
        'Clarify exactly what\'s in the package: food choices, party bags, invitations, and host time differ significantly.',
        'Confirm the venue\'s cake policy before ordering a cake.',
        'Ask about adult supervision ratios and whether venue staff are included for the children during play time.',
      ],
    }),
  },

  'sen-friendly': {
    heroGradient: 'from-green-600 to-emerald-400',
    badgeClasses: 'bg-green-50 border-green-200 text-green-700',
    faqHeading: 'SEN Soft Play FAQs',
    faqs: (cityName) => [
      {
        question: `What are SEN-friendly soft play sessions in ${cityName}?`,
        answer: `SEN sessions are set aside for children with special educational needs and disabilities. What changes differs by venue, but it usually means fewer children and a calmer room, often with music and lights turned down. Ask the ${cityName} venue what its sessions involve.`,
      },
      {
        question: `When are SEN sessions held at soft play in ${cityName}?`,
        answer: `Each venue sets its own times. Some run SEN sessions weekly and others monthly, and they may be early in the day, in the evening or at weekends. Check the venue page or contact the venue for current dates.`,
      },
      {
        question: `Do I need to book SEN soft play sessions in advance?`,
        answer: `It depends on the venue: some SEN sessions need booking to keep numbers down, others are drop-in. Call ahead to confirm the date, whether to book and whether the session suits your child.`,
      },
      {
        question: `Are soft play centres in ${cityName} wheelchair accessible?`,
        answer: `Accessibility varies between venues, and we only show wheelchair access on a venue page where it has been confirmed. If you have particular access needs, call the venue before you travel.`,
      },
    ],
    advice: (cityName) => ({
      heading: `Visiting SEN-Friendly Soft Play in ${cityName}`,
      tips: [
        'Call ahead to confirm SEN session dates and whether you need to book.',
        'Ask about the sensory environment: some venues dim lights and turn off background music for SEN sessions.',
                'Tell staff about your child\'s needs when you arrive, or when you book.',
        'Ask whether you can visit beforehand, so your child can see the space when it is quiet.',
      ],
    }),
  },

  'open-now': {
    heroGradient: 'from-purple-600 to-indigo-500',
    badgeClasses: 'bg-green-50 border-green-200 text-green-700',
    faqHeading: 'Opening Times FAQs',
    faqs: (cityName) => [
      {
        question: `What time do soft play centres open in ${cityName}?`,
        answer: `${TYPICAL_HOURS_SENTENCE} We show a venue's hours on its page where the venue has published them, and say so where we don't have them. Call or check the venue's own website before travelling.`,
      },
      {
        question: `Are soft play centres in ${cityName} open at weekends?`,
        answer: `Most soft play centres open at weekends, but hours often differ from weekdays and some close early for private parties. Each venue page shows the hours we hold.`,
      },
      {
        question: `Are soft play centres open during school holidays in ${cityName}?`,
        answer: `Soft play is busiest in school holidays, and many venues change their hours or session times then. Check the venue page or the venue's own website before you travel.`,
      },
    ],
    advice: (cityName) => ({
      heading: `What to Know Before You Visit in ${cityName}`,
      tips: [
        'Opening times shown are general guidelines — always verify directly with the venue before travelling.',
        'Hours can change in school holidays and half-terms, so check before you travel.',
        'Some venues require pre-booking even for casual visits — book online to guarantee a slot.',
        'If travelling at a specific time, call ahead: venues may close early for private parties.',
      ],
    }),
  },
}

export function getFilterContent(slug: FilterSlug): FilterContentConfig {
  return filterContentMap[slug]
}
