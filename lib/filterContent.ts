/**
 * Per-filter content configuration: FAQs, advice tips, and styling.
 * Used by the shared FilterPageContent component.
 */

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
        answer: `Toddler areas at soft play centres in ${cityName} are typically designed for children under 3 or 4 years old. These sections have age-appropriate equipment including soft mats, low-level slides, ball pits, and sensory toys, all separated from the larger frame used by older children.`,
      },
      {
        question: `Are babies welcome at soft play in ${cityName}?`,
        answer: `Yes, most soft play centres in ${cityName} welcome babies. Many have dedicated baby areas with soft textures, mirrors, and sensory toys. Babies under 12 months usually enter free. Look for venues that specifically mention baby or under-1s sections.`,
      },
      {
        question: `Do toddler soft play centres in ${cityName} have cafes?`,
        answer: `Most toddler-friendly venues in ${cityName} have on-site cafes serving hot drinks, snacks, and children's meals. Many offer baby-friendly options and high chairs. Some venues also allow you to bring your own food — check the venue page before you visit.`,
      },
      {
        question: `When is the best time to visit toddler soft play in ${cityName}?`,
        answer: `Weekday mornings are the best time for toddler soft play in ${cityName}. Many venues run dedicated toddler-only sessions on Tuesday to Thursday mornings, which are noticeably quieter. Avoid weekends and school holiday peak hours if your child prefers a calmer environment.`,
      },
    ],
    advice: (cityName) => ({
      heading: `Tips for Visiting Toddler Soft Play in ${cityName}`,
      tips: [
        'Visit on a weekday morning for the quietest experience — many venues offer dedicated toddler-only sessions Tue–Thu.',
        'Look for venues with a physically separated toddler area so bigger children on the main frame don\'t overwhelm little ones.',
        'Pack socks for everyone — almost all soft play centres require them, and accidents happen.',
        'Check whether the venue has a cafe before you go. Some allow you to bring your own snacks and a flask of tea.',
        'Many venues charge per session rather than per hour, so you can stay as long as the session lasts.',
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
        answer: `Birthday party packages at soft play centres in ${cityName} typically cost between £10 and £15 per child. Most packages include dedicated play time, a private party room, food, and sometimes party bags. Prices vary by venue, day of the week, and package tier — contact venues directly for current pricing.`,
      },
      {
        question: `How far in advance should I book a soft play party in ${cityName}?`,
        answer: `We recommend booking at least 3–4 weeks in advance, especially for weekend slots. Popular venues in ${cityName} fill up quickly during school holidays and half-terms. Most venues now offer online booking so you can check and reserve availability easily.`,
      },
      {
        question: `What is included in a soft play birthday party package?`,
        answer: `Most party packages in ${cityName} include a set amount of play time (usually 1–2 hours in the main frame), exclusive use of a party room for the food portion, children's food (pizza, sandwiches, or hot dogs), drinks, and sometimes party bags. Some venues include a dedicated party host.`,
      },
      {
        question: `Can parents stay during a soft play birthday party?`,
        answer: `Yes, parents and carers are welcome to stay throughout. Most venues provide adult seating near the party room and some include tea and coffee for supervising adults. Check whether the venue charges for adult refreshments or includes them in the package.`,
      },
      {
        question: `Can I bring my own cake to a soft play party?`,
        answer: `Many soft play centres in ${cityName} allow you to bring your own cake — but always confirm this when booking. Some venues have a policy of charging a small cutting fee. A few venues sell their own cakes or cupcakes as an add-on.`,
      },
    ],
    advice: (cityName) => ({
      heading: `How to Plan a Soft Play Birthday Party in ${cityName}`,
      tips: [
        'Book 3–4 weeks ahead for weekends; popular venues fill up fast during school holidays.',
        'Ask explicitly whether the party room is exclusively yours or shared — this varies between venues.',
        'Clarify exactly what\'s in the package: food choices, party bags, invitations, and host time differ significantly.',
        'Confirm the venue\'s cake policy before ordering — most allow homemade cakes but some charge a cutting fee.',
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
        answer: `SEN-friendly sessions at soft play centres in ${cityName} are designed for children with Special Educational Needs and disabilities. They typically feature reduced numbers, lower music and lighting levels, and additional staff support — creating a calmer, more accessible environment.`,
      },
      {
        question: `When are SEN sessions held at soft play in ${cityName}?`,
        answer: `SEN sessions in ${cityName} are usually held on quieter weekday mornings, often before general admission opens. Schedules vary significantly between venues — some run weekly sessions, others monthly. Contact venues directly or check their individual listing pages for current schedules.`,
      },
      {
        question: `Do I need to book SEN soft play sessions in advance?`,
        answer: `It depends on the venue. Some SEN sessions in ${cityName} require pre-booking to manage numbers, while others operate as quiet drop-ins. We recommend calling ahead to confirm the schedule, any booking requirements, and whether the session suits your child's specific needs.`,
      },
      {
        question: `Are soft play centres in ${cityName} wheelchair accessible?`,
        answer: `Many soft play centres in ${cityName} have wheelchair-accessible facilities including step-free entrances, accessible toilets, and ground-floor play areas. Accessibility varies between venues. Check individual venue pages for specific details, or call ahead if you have particular access requirements.`,
      },
    ],
    advice: (cityName) => ({
      heading: `Visiting SEN-Friendly Soft Play in ${cityName}`,
      tips: [
        'Call ahead to confirm dedicated SEN session times — many venues run them monthly and they can fill up quickly.',
        'Ask about the sensory environment: some venues dim lights and turn off background music for SEN sessions.',
        'Early weekday mornings (before 11am) are generally the quietest times even outside dedicated sessions.',
        'Inform staff about your child\'s specific needs on arrival — most SEN-friendly venues will adapt where they can.',
        'Some venues offer a familiarisation visit so children can explore the space before attending a session.',
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
        answer: `Most soft play centres in ${cityName} open between 9:00am and 10:00am and close between 5:00pm and 6:00pm. Weekend and school holiday hours often differ. Always check the venue's individual page or call ahead to confirm current opening times before travelling.`,
      },
      {
        question: `Are soft play centres in ${cityName} open at weekends?`,
        answer: `Yes, the majority of soft play centres in ${cityName} are open on Saturdays and Sundays. Weekend sessions tend to be busier and some venues require advance booking. A few venues close early on Sunday afternoons, so check individual listings.`,
      },
      {
        question: `Are soft play centres open during school holidays in ${cityName}?`,
        answer: `Yes — soft play centres in ${cityName} are typically open throughout all school holidays and often extend their hours. Expect higher footfall during half-terms and the summer holidays. Some venues run special holiday programmes and activities.`,
      },
    ],
    advice: (cityName) => ({
      heading: `What to Know Before You Visit in ${cityName}`,
      tips: [
        'Opening times shown are general guidelines — always verify directly with the venue before travelling.',
        'Many venues extend hours during school holidays and half-terms; some close early on Sundays.',
        'Some venues require pre-booking even for casual visits — book online to guarantee a slot.',
        'If travelling at a specific time, call ahead: venues may close early for private parties.',
      ],
    }),
  },
}

export function getFilterContent(slug: FilterSlug): FilterContentConfig {
  return filterContentMap[slug]
}
