import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  Coffee,
  Car,
  Cake,
  Baby,
  Heart,
  Accessibility,
  Wifi,
  Lock,
  Trees,
  Wind,
  Footprints,
  CheckCircle2,
  XCircle,
  Toilet,
  Drama,
  Sparkles,
  PartyPopper,
} from 'lucide-react'

interface FacilitiesData {
  cafe?: boolean | null
  parking?: boolean | null
  parties?: boolean | null
  party_rooms?: boolean
  toddler_area?: boolean
  baby_area?: boolean
  sensory_area?: boolean
  role_play_area?: boolean
  sen_friendly?: boolean
  wheelchair_access?: boolean
  disabled_access?: boolean
  free_wifi?: boolean
  toilets?: boolean
  baby_change?: boolean
  // legacy keys — kept for backwards compatibility
  baby_changing?: boolean
  [key: string]: boolean | null | undefined
}

interface FacilitiesGridProps {
  facilities: FacilitiesData | null
  // Legacy boolean props for backwards compatibility
  cafe?: boolean
  parking?: boolean
  parties?: boolean
  toddlerArea?: boolean | null
  babyArea?: boolean | null
  senFriendly?: boolean | null
  wheelchairAccess?: boolean | null
  freeWifi?: boolean | null
  /** When true, render a fallback card instead of null when no data is available */
  showEmptyState?: boolean
}

interface FacilityConfig {
  key: string
  label: string
  icon: React.ElementType
  category: 'amenities' | 'accessibility' | 'activities'
}

const FACILITY_CONFIG: FacilityConfig[] = [
  // Amenities
  { key: 'cafe',         label: 'Café',           icon: Coffee,       category: 'amenities' },
  { key: 'parking',      label: 'Parking',         icon: Car,          category: 'amenities' },
  { key: 'free_wifi',    label: 'Free WiFi',       icon: Wifi,         category: 'amenities' },
  { key: 'toilets',      label: 'Toilets',         icon: Toilet,       category: 'amenities' },
  { key: 'baby_change',  label: 'Baby Changing',   icon: Baby,         category: 'amenities' },
  // legacy key — some older records use baby_changing
  { key: 'baby_changing',label: 'Baby Changing',   icon: Baby,         category: 'amenities' },

  // Accessibility
  { key: 'wheelchair_access', label: 'Wheelchair Access', icon: Accessibility, category: 'accessibility' },
  { key: 'disabled_access',   label: 'Disabled Access',   icon: Accessibility, category: 'accessibility' },
  { key: 'sen_friendly',      label: 'SEN Friendly',      icon: Heart,         category: 'accessibility' },

  // Play areas & activities
  { key: 'toddler_area',  label: 'Toddler Area',     icon: Baby,         category: 'activities' },
  { key: 'baby_area',     label: 'Baby Area',        icon: Baby,         category: 'activities' },
  { key: 'sensory_area',  label: 'Sensory Area',     icon: Sparkles,     category: 'activities' },
  { key: 'role_play_area',label: 'Role Play Area',   icon: Drama,        category: 'activities' },
  { key: 'parties',       label: 'Birthday Parties', icon: Cake,         category: 'activities' },
  { key: 'party_rooms',   label: 'Party Rooms',      icon: PartyPopper,  category: 'activities' },
]

const CATEGORY_LABELS: Record<string, string> = {
  amenities: 'Amenities',
  accessibility: 'Accessibility',
  activities: 'Activities & Areas',
}

export function FacilitiesGrid({
  facilities,
  cafe,
  parking,
  parties,
  toddlerArea,
  babyArea,
  senFriendly,
  wheelchairAccess,
  freeWifi,
  showEmptyState = false,
}: FacilitiesGridProps) {
  // Merge facilities data with legacy props
  const mergedFacilities: FacilitiesData = {
    ...(facilities || {}),
    cafe: facilities?.cafe ?? cafe,
    parking: facilities?.parking ?? parking,
    parties: facilities?.parties ?? parties,
    toddler_area: facilities?.toddler_area ?? toddlerArea,
    baby_area: facilities?.baby_area ?? babyArea,
    sen_friendly: facilities?.sen_friendly ?? senFriendly,
    wheelchair_access: facilities?.wheelchair_access ?? wheelchairAccess,
    free_wifi: facilities?.free_wifi ?? freeWifi,
  }

  // Check if we have any facilities to display
  const hasFacilities = FACILITY_CONFIG.some(
    (f) => mergedFacilities[f.key] != null
  )

  if (!hasFacilities) {
    if (!showEmptyState) return null
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Facilities &amp; Features</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">
            We&apos;re still gathering detailed facility information for this venue.
            Check directly with the venue for the most up-to-date details.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Get available (true) facilities
  const availableFacilities = FACILITY_CONFIG.filter(
    (f) => mergedFacilities[f.key] === true
  )

  // Group by category
  const groupedFacilities = availableFacilities.reduce<Record<string, FacilityConfig[]>>(
    (acc, facility) => {
      if (!acc[facility.category]) acc[facility.category] = []
      acc[facility.category].push(facility)
      return acc
    },
    {}
  )

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Facilities & Features</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(groupedFacilities).map(([category, categoryFacilities]) => (
          <div key={category}>
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
              {CATEGORY_LABELS[category]}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {categoryFacilities.map((facility) => {
                const Icon = facility.icon
                const isAvailable = mergedFacilities[facility.key]

                return (
                  <div
                    key={facility.key}
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-lg',
                      isAvailable
                        ? 'bg-green-50 text-green-700'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className="text-sm font-medium">{facility.label}</span>
                    {isAvailable ? (
                      <CheckCircle2 className="h-4 w-4 ml-auto flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 ml-auto flex-shrink-0" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// Simple badge-style facilities display for compact views
export function FacilitiesBadges({
  facilities,
  cafe,
  parking,
  parties,
  toddlerArea,
  senFriendly,
  wheelchairAccess,
}: Omit<FacilitiesGridProps, 'babyArea' | 'freeWifi'>) {
  const mergedFacilities: FacilitiesData = {
    ...(facilities || {}),
    cafe: facilities?.cafe ?? cafe,
    parking: facilities?.parking ?? parking,
    parties: facilities?.parties ?? parties,
    toddler_area: facilities?.toddler_area ?? toddlerArea,
    sen_friendly: facilities?.sen_friendly ?? senFriendly,
    wheelchair_access: facilities?.wheelchair_access ?? wheelchairAccess,
  }

  const badges = [
    { key: 'toddler_area', label: 'Toddler Friendly', icon: Baby },
    { key: 'parties', label: 'Birthday Parties', icon: Cake },
    { key: 'cafe', label: 'Cafe', icon: Coffee },
    { key: 'parking', label: 'Parking', icon: Car },
    { key: 'sen_friendly', label: 'SEN Friendly', icon: Heart },
    { key: 'wheelchair_access', label: 'Wheelchair Access', icon: Accessibility },
  ]

  const activeBadges = badges.filter((b) => mergedFacilities[b.key])

  if (activeBadges.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {activeBadges.map((badge) => {
        const Icon = badge.icon
        return (
          <span
            key={badge.key}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-medium"
          >
            <Icon className="h-3.5 w-3.5" />
            {badge.label}
          </span>
        )
      })}
    </div>
  )
}
