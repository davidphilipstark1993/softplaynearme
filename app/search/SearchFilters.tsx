'use client'

import { FilterSidebar } from '@/components/search/FilterSidebar'

interface SearchFiltersProps {
  hasLocation: boolean
}

export function SearchFilters({ hasLocation }: SearchFiltersProps) {
  return <FilterSidebar hasLocation={hasLocation} showSort />
}
