/**
 * Reusable component for injecting JSON-LD structured data.
 * Accepts any schema object and renders it as a <script> tag.
 *
 * Usage:
 *   <JsonLd data={buildLocalBusinessSchema({ ... })} />
 */

interface JsonLdProps {
  data: Record<string, any> | null | undefined
}

export function JsonLd({ data }: JsonLdProps) {
  if (!data) return null

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
