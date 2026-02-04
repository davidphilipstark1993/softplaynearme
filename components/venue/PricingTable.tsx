import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PoundSterling, Clock } from 'lucide-react'

interface PricingItem {
  id: number
  price_type: string
  age_group: string
  price: string | number
  duration_minutes: number | null
  notes: string | null
}

interface PricingTableProps {
  pricing: PricingItem[]
  priceFrom?: number | null
  priceTo?: number | null
}

const AGE_GROUP_LABELS: Record<string, string> = {
  under_1: 'Under 1 year',
  '1_to_3': '1-3 years',
  '4_to_8': '4-8 years',
  '9_plus': '9+ years',
  adult: 'Adult',
}

const PRICE_TYPE_LABELS: Record<string, string> = {
  standard: 'Standard',
  peak: 'Peak Times',
  off_peak: 'Off-Peak',
  weekend: 'Weekends',
}

function formatPrice(price: string | number): string {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price
  if (numPrice === 0) return 'Free'
  return `£${numPrice.toFixed(2)}`
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return ''
  if (minutes < 60) return `${minutes} min session`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hours} hour session`
  return `${hours}h ${mins}m session`
}

export function PricingTable({ pricing, priceFrom, priceTo }: PricingTableProps) {
  if (!pricing || pricing.length === 0) {
    // Fall back to simple price range display
    if (priceFrom || priceTo) {
      return (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <PoundSterling className="h-5 w-5 text-purple-600" />
              Pricing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600">
              {priceFrom && priceTo && priceFrom !== priceTo
                ? `£${Number(priceFrom).toFixed(2)} - £${Number(priceTo).toFixed(2)}`
                : priceFrom
                  ? `From £${Number(priceFrom).toFixed(2)}`
                  : priceTo
                    ? `Up to £${Number(priceTo).toFixed(2)}`
                    : 'Contact for pricing'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Per child per session</p>
          </CardContent>
        </Card>
      )
    }
    return null
  }

  // Group pricing by type
  const groupedPricing = pricing.reduce<Record<string, PricingItem[]>>((acc, item) => {
    const type = item.price_type || 'standard'
    if (!acc[type]) acc[type] = []
    acc[type].push(item)
    return acc
  }, {})

  // Get duration from first item (assuming consistent duration)
  const duration = pricing[0]?.duration_minutes

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <PoundSterling className="h-5 w-5 text-purple-600" />
            Pricing
          </CardTitle>
          {duration && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(duration)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(groupedPricing).map(([priceType, items]) => (
          <div key={priceType}>
            {Object.keys(groupedPricing).length > 1 && (
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                {PRICE_TYPE_LABELS[priceType] || priceType}
              </h4>
            )}
            <div className="space-y-2">
              {items
                .sort((a, b) => {
                  const order = ['under_1', '1_to_3', '4_to_8', '9_plus', 'adult']
                  return order.indexOf(a.age_group) - order.indexOf(b.age_group)
                })
                .map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                  >
                    <div>
                      <span className="font-medium">
                        {AGE_GROUP_LABELS[item.age_group] || item.age_group}
                      </span>
                      {item.notes && (
                        <p className="text-xs text-muted-foreground">{item.notes}</p>
                      )}
                    </div>
                    <span
                      className={`font-bold ${
                        parseFloat(String(item.price)) === 0
                          ? 'text-green-600'
                          : 'text-purple-600'
                      }`}
                    >
                      {formatPrice(item.price)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
