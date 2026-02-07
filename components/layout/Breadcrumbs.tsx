import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <div className="bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-slate-600 overflow-x-auto">
          <Link href="/" className="hover:text-purple-600 flex items-center gap-1 flex-shrink-0">
            <Home className="w-3.5 h-3.5" />
            <span className="sr-only sm:not-sr-only">Home</span>
          </Link>
          {items.map((item, i) => (
            <span key={i} className="flex items-center gap-1.5 min-w-0">
              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
              {item.href ? (
                <Link href={item.href} className="hover:text-purple-600 truncate">
                  {item.label}
                </Link>
              ) : (
                <span className="text-slate-900 truncate">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>
    </div>
  )
}
