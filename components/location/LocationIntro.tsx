/**
 * Renders a multi-paragraph location intro for SEO depth.
 * Server component — no client-side JS.
 *
 * Supports inline links using markdown syntax: [text](url)
 */

import Link from 'next/link'
import { Fragment } from 'react'

interface LocationIntroProps {
  content: string       // Multi-paragraph string separated by \n\n
  locationName: string
}

/**
 * Parse markdown-style links [text](url) in a string and return
 * an array of React elements (strings + <Link> components).
 */
function parseLinks(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    // Text before the link
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    const linkText = match[1]
    const linkUrl = match[2]

    // Use Next.js Link for internal URLs, <a> for external
    if (linkUrl.startsWith('/')) {
      parts.push(
        <Link
          key={match.index}
          href={linkUrl}
          className="text-purple-600 hover:text-purple-700 underline"
        >
          {linkText}
        </Link>
      )
    } else {
      parts.push(
        <a
          key={match.index}
          href={linkUrl}
          className="text-purple-600 hover:text-purple-700 underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {linkText}
        </a>
      )
    }

    lastIndex = match.index + match[0].length
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
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
            {parseLinks(p)}
          </p>
        ))}
      </div>
    </section>
  )
}
