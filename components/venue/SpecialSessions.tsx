import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Baby, Heart, Sparkles, Volume2 } from 'lucide-react'

interface Session {
  id: number
  session_type: string
  day_of_week: number
  start_time: string
  end_time: string
  description: string | null
  booking_required: boolean
}

interface SpecialSessionsProps {
  sessions: Session[]
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const SESSION_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  toddler: {
    label: 'Toddler Session',
    icon: Baby,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  baby: {
    label: 'Baby Session',
    icon: Baby,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
  },
  sen: {
    label: 'SEN Session',
    icon: Heart,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  autism_friendly: {
    label: 'Autism Friendly',
    icon: Volume2,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
  },
  sensory: {
    label: 'Sensory Play',
    icon: Sparkles,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
  },
}

function formatTime(time: string): string {
  // Handle "HH:MM:SS" format from database
  const parts = time.split(':')
  const hours = parseInt(parts[0], 10)
  const minutes = parts[1]
  const period = hours >= 12 ? 'pm' : 'am'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${minutes}${period}`
}

function getNextOccurrence(dayOfWeek: number): string {
  const today = new Date().getDay()
  const daysUntil = (dayOfWeek - today + 7) % 7
  if (daysUntil === 0) return 'Today'
  if (daysUntil === 1) return 'Tomorrow'
  return DAY_NAMES[dayOfWeek]
}

export function SpecialSessions({ sessions }: SpecialSessionsProps) {
  if (!sessions || sessions.length === 0) {
    return null
  }

  // Group sessions by type
  const groupedSessions = sessions.reduce<Record<string, Session[]>>((acc, session) => {
    const type = session.session_type || 'other'
    if (!acc[type]) acc[type] = []
    acc[type].push(session)
    return acc
  }, {})

  // Sort sessions within each group by day of week
  Object.values(groupedSessions).forEach((group) => {
    group.sort((a, b) => a.day_of_week - b.day_of_week)
  })

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5 text-purple-600" />
          Special Sessions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(groupedSessions).map(([sessionType, typeSessions]) => {
          const config = SESSION_CONFIG[sessionType] || {
            label: sessionType.charAt(0).toUpperCase() + sessionType.slice(1).replace('_', ' '),
            icon: Calendar,
            color: 'text-gray-600',
            bgColor: 'bg-gray-50',
          }
          const Icon = config.icon

          return (
            <div key={sessionType} className={`p-4 rounded-lg ${config.bgColor}`}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`h-5 w-5 ${config.color}`} />
                <h4 className={`font-semibold ${config.color}`}>{config.label}</h4>
              </div>

              {typeSessions[0]?.description && (
                <p className="text-sm text-muted-foreground mb-3">
                  {typeSessions[0].description}
                </p>
              )}

              <div className="space-y-2">
                {typeSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between bg-white/70 rounded-md px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {DAY_NAMES[session.day_of_week]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({getNextOccurrence(session.day_of_week)})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-sm tabular-nums">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatTime(session.start_time)} - {formatTime(session.end_time)}
                      </span>
                      {session.booking_required && (
                        <Badge variant="secondary" className="text-xs">
                          Booking required
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        <p className="text-xs text-muted-foreground">
          Special sessions may have limited capacity. Contact the venue to book or check availability.
        </p>
      </CardContent>
    </Card>
  )
}
