import Link from 'next/link'
import type { HubGuide as HubGuideData } from '@/lib/hubGuides'
import { VERIFIED_ON } from '@/lib/hubGuides'

/** Renders `[label](/path)` links in guide text; everything else is plain text. */
function renderText(text: string) {
  const parts = text.split(/(\[[^\]]+\]\(\/[^)]*\))/g)
  return parts.map((part, i) => {
    const m = part.match(/^\[([^\]]+)\]\((\/[^)]*)\)$/)
    return m ? (
      <Link key={i} href={m[2]} className="text-purple-700 underline hover:text-purple-900">{m[1]}</Link>
    ) : (
      <span key={i}>{part}</span>
    )
  })
}

export function HubGuide({ guide, cityName }: { guide: HubGuideData; cityName: string }) {
  return (
    <section aria-labelledby="hub-guide-heading" className="mt-12 max-w-3xl">
      {guide.sections.map((s, i) => {
        const Heading = i === 0 ? 'h2' : 'h3'
        return (
          <div key={s.heading} className={i === 0 ? '' : 'mt-6'}>
            <Heading
              id={i === 0 ? 'hub-guide-heading' : undefined}
              className={i === 0 ? 'text-xl font-semibold mb-3' : 'text-lg font-semibold mb-2 text-slate-800'}
            >
              {s.heading}
            </Heading>
            {s.paragraphs.map((p, j) => (
              <p key={j} className="text-slate-700 leading-relaxed mb-3">{renderText(p)}</p>
            ))}
          </div>
        )
      })}
      <p className="mt-4 text-xs text-slate-500">
        Details in this guide were checked against each venue&apos;s own website or Google listing on {VERIFIED_ON}. Hours, prices and sessions change, so confirm with the venue before travelling to {cityName}.
      </p>
    </section>
  )
}

export function NearbyHubs({ hubs, cityName }: { hubs: { slug: string; label: string }[]; cityName: string }) {
  if (hubs.length === 0) return null
  return (
    <section aria-labelledby="nearby-hubs-heading" className="mt-12">
      <h2 id="nearby-hubs-heading" className="text-xl font-semibold mb-3">More soft play near {cityName}</h2>
      <ul className="flex flex-wrap gap-2">
        {hubs.map((h) => (
          <li key={h.slug}>
            <Link href={`/soft-play/${h.slug}`} className="inline-block rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm hover:bg-purple-50 hover:border-purple-300">
              Soft play in {h.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
