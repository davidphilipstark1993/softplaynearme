import type { CuratedVenueGroup } from '@/data/hullCuratedVenues'

/**
 * Renders one hand-curated, fact-checked venue list section (heading + intro
 * + venue cards linking to each venue's own official site). Server
 * component — no client-side JS. See data/hullCuratedVenues.ts for the
 * content contract and why this isn't a generic per-city mechanism.
 */
export function CuratedVenueSection({ group }: { group: CuratedVenueGroup }) {
  if (group.venues.length === 0) return null

  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold text-slate-900 mb-2">{group.heading}</h2>
      {group.intro && <p className="text-slate-600 leading-relaxed mb-4">{group.intro}</p>}
      <ul className="space-y-3">
        {group.venues.map((v) => (
          <li key={v.name} className="border border-slate-200 rounded-lg p-4 bg-white">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <a
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-purple-600 hover:text-purple-700 underline"
              >
                {v.name}
              </a>
              <span className="text-xs uppercase tracking-wide text-slate-400">{v.category}</span>
            </div>
            {v.note && <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{v.note}</p>}
          </li>
        ))}
      </ul>
    </section>
  )
}
