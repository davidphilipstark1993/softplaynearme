import type { Metadata } from 'next'
import { CategoryHubPage, buildHubMetadata } from '@/components/category/CategoryHubPage'

export const revalidate = 3600

export function generateMetadata(): Promise<Metadata> {
  return buildHubMetadata('soft-play-parties')
}

export default function Page() {
  return <CategoryHubPage slug="soft-play-parties" />
}
