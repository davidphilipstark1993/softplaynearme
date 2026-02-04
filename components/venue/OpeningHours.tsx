import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OpeningHoursData {
  [key: string]: string
}

interface OpeningHoursProps {
  hours: OpeningHoursData | null
  className?: string
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
  const todayHours = hours[todayKey]

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

function formatHours(hours: string): string {
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
        <ul className="space-y-2">
          {DAYS.map(({ key, label }) => {
            const isToday = key === todayKey
            const dayHours = hours[key]

            return (
              <li
                key={key}
                className={cn(
                  'flex justify-between py-1.5 px-2 rounded-md text-sm',
                  isToday && 'bg-purple-50 font-medium'
                )}
              >
                <span className={cn(isToday && 'text-purple-700')}>
                  {label}
                  {isToday && (
                    <span className="ml-2 text-xs text-purple-500">(Today)</span>
                  )}
                </span>
                <span
                  className={cn(
                    'tabular-nums',
                    !dayHours || dayHours.toLowerCase() === 'closed'
                      ? 'text-muted-foreground'
                      : isToday
                        ? 'text-purple-700'
                        : ''
                  )}
                >
                  {formatHours(dayHours)}
                </span>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
