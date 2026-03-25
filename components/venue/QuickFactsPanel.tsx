import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Baby,
  Car,
  Coffee,
  Cake,
  Accessibility,
  CalendarCheck,
  PoundSterling,
  Clock,
  Users,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react'

interface QuickFactsProps {
  // Age
  ageRangeMin?: number | null
  ageRangeMax?: number | null
  ageRanges?: string[] | null

  // Booking
  acceptsWalkIns?: boolean | null
  prebookingRequired?: boolean | null

  // Pricing
  priceFrom?: number | null
  priceTo?: number | null
  priceRange?: string | null

  // Hours — just whether confirmed or not (detail shown in OpeningHours component)
  hasOpeningHours?: boolean

  // Key facilities
  cafe?: boolean
  parking?: boolean
  parties?: boolean
  toddlerArea?: boolean
  babyArea?: boolean
  senFriendly?: boolean
  wheelchairAccess?: boolean
  disabledAccess?: boolean
}

interface FactRowProps {
  icon: React.ElementType
  label: string
  value: string
  confirmed: boolean
}

function FactRow({ icon: Icon, label, value, confirmed }: FactRowProps) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className="flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-0.5">
          {label}
        </span>
        <span className={`text-sm ${confirmed ? 'text-slate-800 font-medium' : 'text-slate-400 italic'}`}>
          {value}
        </span>
      </div>
      <div className="flex-shrink-0 mt-0.5">
        {confirmed
          ? <CheckCircle2 className="w-4 h-4 text-green-500" />
          : <HelpCircle className="w-4 h-4 text-slate-300" />
        }
      </div>
    </div>
  )
}

export function QuickFactsPanel({
  ageRangeMin,
  ageRangeMax,
  ageRanges,
  acceptsWalkIns,
  prebookingRequired,
  priceFrom,
  priceTo,
  priceRange,
  hasOpeningHours,
  cafe,
  parking,
  parties,
  toddlerArea,
  babyArea,
  senFriendly,
  wheelchairAccess,
  disabledAccess,
}: QuickFactsProps) {

  // ── Age ──────────────────────────────────────────────────────────────
  let ageValue = 'Not yet confirmed'
  let ageConfirmed = false
  if (ageRangeMin != null && ageRangeMax != null) {
    ageValue = ageRangeMin === 0
      ? `Babies to age ${ageRangeMax}`
      : `Ages ${ageRangeMin}–${ageRangeMax}`
    ageConfirmed = true
  } else if (ageRanges && ageRanges.length > 0) {
    ageValue = ageRanges.join(', ')
    ageConfirmed = true
  }

  // ── Booking ──────────────────────────────────────────────────────────
  let bookingValue = 'Not yet confirmed'
  let bookingConfirmed = false
  if (prebookingRequired === true) {
    bookingValue = 'Advance booking required'
    bookingConfirmed = true
  } else if (acceptsWalkIns === true) {
    bookingValue = 'Walk-ins welcome'
    bookingConfirmed = true
  }

  // ── Pricing ──────────────────────────────────────────────────────────
  let pricingValue = 'Not yet confirmed'
  let pricingConfirmed = false
  if (priceFrom != null && priceTo != null && priceFrom !== priceTo) {
    pricingValue = `£${Number(priceFrom).toFixed(2)}–£${Number(priceTo).toFixed(2)} per child`
    pricingConfirmed = true
  } else if (priceFrom != null) {
    pricingValue = `From £${Number(priceFrom).toFixed(2)} per child`
    pricingConfirmed = true
  } else if (priceRange) {
    pricingValue = priceRange
    pricingConfirmed = true
  }

  // ── Opening hours ────────────────────────────────────────────────────
  const hoursValue = hasOpeningHours ? 'See opening hours below' : 'Not yet confirmed'
  const hoursConfirmed = !!hasOpeningHours

  // ── Accessibility ────────────────────────────────────────────────────
  const isAccessible = wheelchairAccess === true || disabledAccess === true
  let accessValue = 'Not yet confirmed'
  let accessConfirmed = false
  if (wheelchairAccess === true || disabledAccess === true) {
    accessValue = 'Wheelchair accessible'
    accessConfirmed = true
  } else if (wheelchairAccess === false && disabledAccess === false) {
    accessValue = 'Accessibility details not confirmed'
    accessConfirmed = false
  }

  // ── Key facilities ───────────────────────────────────────────────────
  const facilityItems: string[] = []
  if (cafe === true)        facilityItems.push('Café')
  if (parking === true)     facilityItems.push('Parking')
  if (parties === true)     facilityItems.push('Birthday parties')
  if (toddlerArea === true) facilityItems.push('Toddler area')
  if (babyArea === true)    facilityItems.push('Baby area')
  if (senFriendly === true) facilityItems.push('SEN friendly')

  const facilitiesValue = facilityItems.length > 0
    ? facilityItems.join(' · ')
    : 'Detailed facilities not yet confirmed'
  const facilitiesConfirmed = facilityItems.length > 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-slate-700 flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-500" />
          Quick Facts
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <FactRow icon={Baby}         label="Age suitability" value={ageValue}         confirmed={ageConfirmed} />
        <FactRow icon={Coffee}       label="Key facilities"  value={facilitiesValue}  confirmed={facilitiesConfirmed} />
        <FactRow icon={Accessibility} label="Accessibility"  value={accessValue}      confirmed={accessConfirmed} />
        <FactRow icon={CalendarCheck} label="Booking"        value={bookingValue}     confirmed={bookingConfirmed} />
        <FactRow icon={PoundSterling} label="Pricing"        value={pricingValue}     confirmed={pricingConfirmed} />
        <FactRow icon={Clock}        label="Opening hours"   value={hoursValue}       confirmed={hoursConfirmed} />
        {!pricingConfirmed && !hoursConfirmed && (
          <p className="text-xs text-slate-400 mt-3 leading-relaxed">
            Some details are still being confirmed. Check directly with the venue before visiting.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
