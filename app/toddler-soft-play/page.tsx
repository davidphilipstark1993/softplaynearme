import type { Metadata } from 'next'
import { CategoryHubPage, buildHubMetadata } from '@/components/category/CategoryHubPage'

export const revalidate = 3600

export function generateMetadata(): Promise<Metadata> {
  return buildHubMetadata('toddler-soft-play')
}

export default function Page() {
  return <CategoryHubPage slug="toddler-soft-play" />
}
