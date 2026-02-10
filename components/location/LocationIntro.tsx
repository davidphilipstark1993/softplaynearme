/**
 * Renders a multi-paragraph location intro for SEO depth.
 * Server component — no client-side JS.
 */

interface LocationIntroProps {
  content: string       // Multi-paragraph string separated by \n\n
  locationName: string
}

export function LocationIntro({ content, locationName }: LocationIntroProps) {
  const paragraphs = content.split('\n\n').filter(Boolean)

  if (paragraphs.length === 0) return null

  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold text-slate-900 mb-4">
        About Soft Play in {locationName}
      </h2>
      <div className="space-y-4">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-slate-600 leading-relaxed">
            {p}
          </p>
        ))}
      </div>
    </section>
  )
}
