import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OpeningHoursObject {
  open: string
  close: string
}

type OpeningHoursValue = string | OpeningHoursObject

interface OpeningHoursData {
  [key: string]: OpeningHoursValue
}

interface OpeningHoursProps {
  hours: OpeningHoursData | null
  className?: string
}

/**
 * Normalize an opening hours value to a display string.
 * Handles both plain strings ("9:00am - 5:00pm") and objects ({ open: "09:30", close: "17:00" }).
 */
function normalizeHoursValue(value: OpeningHoursValue | undefined): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value.open && value.close) {
    if (value.open === 'closed' || value.close === 'closed') return 'closed'
    return `${value.open} - ${value.close}`
  }
  return undefined
}

const DAYS = [
  { key: 'monday', label: 'Monday', short: 'Mon' },
  { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { key: 'thursday', label: 'Thursday', short: 'Thu' },
  { key: 'friday', label: 'Friday', short: 'Fri' },
  { key: 'saturday', label: 'Saturday', short: 'Sat' },
  { key: 'sunday', label: 'Sunday', short: 'Sun' },
]

function getTodayKey(): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days[new Date().getDay()]
}

function isOpenNow(hours: OpeningHoursData | null): boolean {
  if (!hours) return false

  const todayKey = getTodayKey()
  const todayHours = normalizeHoursValue(hours[todayKey])

  if (!todayHours || todayHours.toLowerCase() === 'closed') {
    return false
  }

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  // Parse hours like "9:00am - 6:00pm" or "09:00 - 18:00"
  const timeMatch = todayHours.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?\s*[-–]\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?/i)

  if (!timeMatch) return false

  let openHour = parseInt(timeMatch[1], 10)
  const openMinute = parseInt(timeMatch[2] || '0', 10)
  const openPeriod = timeMatch[3]?.toLowerCase()

  let closeHour = parseInt(timeMatch[4], 10)
  const closeMinute = parseInt(timeMatch[5] || '0', 10)
  const closePeriod = timeMatch[6]?.toLowerCase()

  // Convert to 24-hour format if needed
  if (openPeriod === 'pm' && openHour !== 12) openHour += 12
  if (openPeriod === 'am' && openHour === 12) openHour = 0
  if (closePeriod === 'pm' && closeHour !== 12) closeHour += 12
  if (closePeriod === 'am' && closeHour === 12) closeHour = 0

  const openMinutes = openHour * 60 + openMinute
  const closeMinutes = closeHour * 60 + closeMinute

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes
}

function formatHours(value: OpeningHoursValue | undefined): string {
  const hours = normalizeHoursValue(value)
  if (!hours || hours.toLowerCase() === 'closed') {
    return 'Closed'
  }
  return hours
}

export function OpeningHours({ hours, className }: OpeningHoursProps) {
  if (!hours) {
    return null
  }

  const todayKey = getTodayKey()
  const isCurrentlyOpen = isOpenNow(hours)

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-purple-600" />
            Opening Hours
          </CardTitle>
          <Badge
            variant={isCurrentlyOpen ? 'default' : 'secondary'}
            className={cn(
              isCurrentlyOpen && 'bg-green-500 hover:bg-green-600'
            )}
          >
            {isCurrentlyOpen ? 'Open Now' : 'Closed'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm border-collapse">
          <caption className="sr-only">Opening hours by day of the week</caption>
          <thead>
            <tr className="sr-only">
              <th scope="col">Day</th>
              <th scope="col">Hours</th>
            </tr>
          </thead>
          <tbody>
            {DAYS.map(({ key, label }) => {
              const isToday = key === todayKey
              const dayHoursRaw = hours[key]
              const dayHours = normalizeHoursValue(dayHoursRaw)

              return (
                <tr
                  key={key}
                  className={cn(
                    'text-sm',
                    isToday && 'bg-purple-50 font-medium'
                  )}
                >
                  <th
                    scope="row"
                    className={cn(
                      'text-left font-normal py-1.5 px-2 rounded-l-md',
                      isToday && 'text-purple-700 font-medium'
                    )}
                  >
                    {label}
                    {isToday && (
                      <span className="ml-2 text-xs text-purple-500">(Today)</span>
                    )}
                  </th>
                  <td
                    className={cn(
                      'tabular-nums text-right py-1.5 px-2 rounded-r-md',
                      !dayHours || dayHours.toLowerCase() === 'closed'
                        ? 'text-muted-foreground'
                        : isToday
                          ? 'text-purple-700'
                          : ''
                    )}
                  >
                    {formatHours(dayHoursRaw)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
