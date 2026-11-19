/** Pages to refresh after an owner edit: the venue page and its city hub. */
export function venuePathsFor(citySlug: string, slug: string): string[] {
  return [`/soft-play/${citySlug}/${slug}`, `/soft-play/${citySlug}`]
}
