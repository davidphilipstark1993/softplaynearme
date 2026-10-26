import Link from 'next/link'
import { formatAgeRange, formatPrice, priceNumber, type HoursPrice } from '@/lib/venueFacts'

export interface ComparisonVenue extends HoursPrice {
  slug: string
  name: string
  /** Town the venue is really in (lib/localities.ts), or null if unknown. */
  area: string | null
  parties?: boolean
  avg_rating?: number | string | null
  review_count?: number | string | null
}

/**
 * Side-by-side facts for a hub's main-list venues. A column only appears when at
 * least one venue has verified data for it, and a cell with no data is left as a
 * dash — never a guess. "Parties" shows Yes only; a missing flag means unknown, not No.
 */
export function VenueComparisonTable({ citySlug, cityName, venues }: { citySlug: string; cityName: string; venues: ComparisonVenue[] }) {
  if (venues.length < 2) return null

  const rows = venues.map((v) => {
    const price = priceNumber(v.price_from)
    const rating = Number(v.avg_rating)
    return {
      v,
      ages: formatAgeRange(v),
      price: price !== null && price > 0 ? `From ${formatPrice(price)}` : null,
      parties: v.parties === true,
      rating: rating > 0 ? `${rating.toFixed(1)} (${Number(v.review_count || 0).toLocaleString('en-GB')})` : null,
    }
  })
  const show = {
    area: rows.some((r) => r.v.area),
    ages: rows.some((r) => r.ages),
    price: rows.some((r) => r.price),
    parties: rows.some((r) => r.parties),
    rating: rows.some((r) => r.rating),
  }
  const dash = <span className="text-slate-400" aria-label="not listed">&ndash;</span>

  return (
    <section aria-labelledby="compare-heading" className="mt-12">
      <h2 id="compare-heading" className="text-xl font-semibold mb-1">Compare soft play in {cityName}</h2>
      <p className="text-sm text-slate-500 mb-4">Only facts we hold for a venue are shown; a dash means we haven&apos;t verified it.</p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Venue</th>
              {show.area && <th scope="col" className="px-4 py-3 font-semibold">Area</th>}
              {show.ages && <th scope="col" className="px-4 py-3 font-semibold">Ages</th>}
              {show.price && <th scope="col" className="px-4 py-3 font-semibold">Price</th>}
              {show.parties && <th scope="col" className="px-4 py-3 font-semibold">Parties</th>}
              {show.rating && <th scope="col" className="px-4 py-3 font-semibold">Rating (reviews)</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ v, ages, price, parties, rating }) => (
              <tr key={v.slug}>
                <th scope="row" className="px-4 py-3 font-medium">
                  <Link href={`/soft-play/${citySlug}/${v.slug}`} className="text-purple-700 hover:underline">{v.name}</Link>
                </th>
                {show.area && <td className="px-4 py-3">{v.area ?? dash}</td>}
                {show.ages && <td className="px-4 py-3">{ages ?? dash}</td>}
                {show.price && <td className="px-4 py-3">{price ?? dash}</td>}
                {show.parties && <td className="px-4 py-3">{parties ? 'Yes' : dash}</td>}
                {show.rating && <td className="px-4 py-3">{rating ?? dash}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
