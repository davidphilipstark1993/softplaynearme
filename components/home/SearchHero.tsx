'use client'

import { SearchForm } from '@/components/search/SearchForm'

/**
 * Client island wrapping the search form for the homepage hero.
 * Keeps the rest of the homepage as a server component for SEO.
 */
export function SearchHero() {
  return (
    <div className="bg-white rounded-xl p-4 shadow-lg max-w-2xl mx-auto min-h-[120px]">
      <SearchForm showRadius={true} defaultRadius={10} />
    </div>
  )
}
