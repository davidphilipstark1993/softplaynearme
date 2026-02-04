'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { FilterPanel } from '@/components/search/FilterPanel'
import { SortDropdown, SortOption } from '@/components/search/SortDropdown'

interface SearchFiltersProps {
  selectedFilters: string[]
  selectedSort: string
  hasLocation: boolean
}

const FILTER_OPTIONS = [
  { key: 'open_now', label: 'Open Now' },
  { key: 'toddler', label: 'Toddler Friendly' },
  { key: 'sen', label: 'SEN Friendly' },
  { key: 'cafe', label: 'Has Cafe' },
  { key: 'parking', label: 'Free Parking' },
  { key: 'parties', label: 'Birthday Parties' },
  { key: 'wheelchair', label: 'Wheelchair Access' },
]

export function SearchFilters({
  selectedFilters,
  selectedSort,
  hasLocation,
}: SearchFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateUrl = useCallback(
    (newFilters: string[], newSort: string) => {
      const params = new URLSearchParams(searchParams.toString())

      if (newFilters.length > 0) {
        params.set('filters', newFilters.join(','))
      } else {
        params.delete('filters')
      }

      if (newSort && newSort !== 'distance') {
        params.set('sort', newSort)
      } else {
        params.delete('sort')
      }

      router.push(`/search?${params.toString()}`)
    },
    [router, searchParams]
  )

  const handleFilterChange = (filters: string[]) => {
    updateUrl(filters, selectedSort)
  }

  const handleSortChange = (sort: SortOption) => {
    updateUrl(selectedFilters, sort)
  }

  return (
    <div className="space-y-4">
      {/* Sort dropdown */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <SortDropdown
          value={selectedSort as SortOption}
          onChange={handleSortChange}
          hasLocation={hasLocation}
        />
      </div>

      {/* Filter panel */}
      <FilterPanel
        filters={FILTER_OPTIONS}
        selectedFilters={selectedFilters}
        onFilterChange={handleFilterChange}
        collapsible={false}
        defaultExpanded={true}
      />
    </div>
  )
}
