import type { Metadata } from 'next'
import { getAllCitySlugs } from '@/lib/venues'
import { FilterPageContent, buildFilterMetadata } from '@/components/filter/FilterPageContent'

interface PageProps {
  params: Promise<{ city: string }>
}

const FILTER_SLUG = 'sen-friendly' as const

export const revalidate = 3600

export async function generateStaticParams() {
  return getAllCitySlugs().map((city) => ({ city }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city } = await params
  return buildFilterMetadata(city, FILTER_SLUG)
}

export default async function SENFriendlyPage({ params }: PageProps) {
  const { city } = await params
  return <FilterPageContent citySlug={city} filterSlug={FILTER_SLUG} />
}
