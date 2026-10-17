'use client'

import { FilterSidebar } from '@/components/search/FilterSidebar'

interface SearchFiltersProps {
  hasLocation: boolean
}

export function SearchFilters({ hasLocation }: SearchFiltersProps) {
  return (
    <FilterSidebar
      hasLocation={hasLocation}
      showSort
      mobileClassName="sticky top-16 z-30 bg-white border border-slate-200 rounded-xl px-4 py-3 mb-4 shadow-sm"
      desktopClassName="sticky top-24"
    />
  )
}
