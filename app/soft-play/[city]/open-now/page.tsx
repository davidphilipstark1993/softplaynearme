import type { Metadata } from 'next'
import { getAllCitySlugs } from '@/lib/venues'
import { FilterPageContent, buildFilterMetadata } from '@/components/filter/FilterPageContent'

interface PageProps {
  params: Promise<{ city: string }>
}

const FILTER_SLUG = 'open-now' as const

// Short revalidation so open/closed status stays accurate
export const revalidate = 60

export async function generateStaticParams() {
  return getAllCitySlugs().map((city) => ({ city }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city } = await params
  return buildFilterMetadata(city, FILTER_SLUG)
}

export default async function OpenNowPage({ params }: PageProps) {
  const { city } = await params
  return <FilterPageContent citySlug={city} filterSlug={FILTER_SLUG} />
}
