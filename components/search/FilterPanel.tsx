'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronDown, ChevronUp, Filter, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FilterOption {
  key: string
  label: string
  icon?: React.ElementType
}

interface FilterPanelProps {
  filters: FilterOption[]
  selectedFilters: string[]
  onFilterChange: (filters: string[]) => void
  className?: string
  collapsible?: boolean
  defaultExpanded?: boolean
}

const DEFAULT_FILTERS: FilterOption[] = [
  { key: 'open_now', label: 'Open Now' },
  { key: 'toddler', label: 'Toddler Friendly' },
  { key: 'sen', label: 'SEN Friendly' },
  { key: 'cafe', label: 'Has Cafe' },
  { key: 'parking', label: 'Free Parking' },
  { key: 'parties', label: 'Birthday Parties' },
  { key: 'wheelchair', label: 'Wheelchair Access' },
]

export function FilterPanel({
  filters = DEFAULT_FILTERS,
  selectedFilters,
  onFilterChange,
  className,
  collapsible = true,
  defaultExpanded = false,
}: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const toggleFilter = (filterKey: string) => {
    if (selectedFilters.includes(filterKey)) {
      onFilterChange(selectedFilters.filter((f) => f !== filterKey))
    } else {
      onFilterChange([...selectedFilters, filterKey])
    }
  }

  const clearAll = () => {
    onFilterChange([])
  }

  const filterContent = (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const isSelected = selectedFilters.includes(filter.key)
          const Icon = filter.icon

          return (
            <button
              key={filter.key}
              onClick={() => toggleFilter(filter.key)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                'border focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2',
                isSelected
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white hover:bg-muted border-border'
              )}
            >
              {Icon && <Icon className="h-4 w-4" />}
              {filter.label}
              {isSelected && <X className="h-3 w-3 ml-1" />}
            </button>
          )
        })}
      </div>

      {selectedFilters.length > 0 && (
        <button
          onClick={clearAll}
          className="text-sm text-muted-foreground hover:text-foreground underline"
        >
          Clear all filters
        </button>
      )}
    </div>
  )

  // Mobile collapsible version
  if (collapsible) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-between w-full"
          >
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filters
              {selectedFilters.length > 0 && (
                <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {selectedFilters.length}
                </span>
              )}
            </CardTitle>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </CardHeader>
        {isExpanded && <CardContent>{filterContent}</CardContent>}
      </Card>
    )
  }

  // Always expanded version for desktop
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4" />
          Filters
          {selectedFilters.length > 0 && (
            <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">
              {selectedFilters.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>{filterContent}</CardContent>
    </Card>
  )
}

// Compact inline filter chips for mobile
export function FilterChips({
  filters = DEFAULT_FILTERS,
  selectedFilters,
  onFilterChange,
  className,
}: Omit<FilterPanelProps, 'collapsible' | 'defaultExpanded'>) {
  const toggleFilter = (filterKey: string) => {
    if (selectedFilters.includes(filterKey)) {
      onFilterChange(selectedFilters.filter((f) => f !== filterKey))
    } else {
      onFilterChange([...selectedFilters, filterKey])
    }
  }

  return (
    <div className={cn('flex overflow-x-auto gap-2 pb-2 -mx-4 px-4', className)}>
      {filters.map((filter) => {
        const isSelected = selectedFilters.includes(filter.key)

        return (
          <button
            key={filter.key}
            onClick={() => toggleFilter(filter.key)}
            className={cn(
              'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap',
              'border transition-colors flex-shrink-0',
              isSelected
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white hover:bg-muted border-border'
            )}
          >
            {filter.label}
          </button>
        )
      })}
    </div>
  )
}
