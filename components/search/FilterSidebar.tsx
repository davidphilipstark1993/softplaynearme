'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState } from 'react'
import { SlidersHorizontal, X, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Filter group definitions ────────────────────────────────────────────────

export const AGE_OPTIONS = [
  { key: 'under2', label: 'Under 2s' },
  { key: 'toddler', label: 'Toddlers (2–4)' },
]

export const FACILITY_OPTIONS = [
  { key: 'cafe', label: 'Café' },
  { key: 'parking', label: 'Free Parking' },
  { key: 'sen', label: 'SEN Sessions' },
  { key: 'parties', label: 'Birthday Parties' },
  { key: 'outdoor', label: 'Outdoor Area' },
]

export const PRICE_OPTIONS = [
  { key: 'under5', label: 'Under £5' },
  { key: '5to8', label: '£5–£8' },
  { key: 'over8', label: '£8+' },
]

export const SPECIAL_OPTIONS = [
  { key: 'open-now', label: 'Open Now' },
  { key: 'wheelchair', label: 'Wheelchair Accessible' },
]

export const SORT_OPTIONS_WITH_LOCATION = [
  { key: 'distance', label: 'Nearest First' },
  { key: 'rating', label: 'Top Rated' },
  { key: 'price_low', label: 'Price: Low–High' },
  { key: 'price_high', label: 'Price: High–Low' },
]

export const SORT_OPTIONS_NO_LOCATION = [
  { key: 'rating', label: 'Top Rated' },
  { key: 'price_low', label: 'Price: Low–High' },
  { key: 'price_high', label: 'Price: High–Low' },
  { key: 'name', label: 'A–Z' },
]

// ─── Main component ───────────────────────────────────────────────────────────

interface FilterSidebarProps {
  hasLocation?: boolean
  /**
   * Whether any venue in the current result set has structured opening hours.
   * When false the "Open Now" option is hidden — it could only ever return
   * nothing, which reads as "nowhere is open" rather than "we don't know".
   */
  openNowAvailable?: boolean
  showSort?: boolean
  className?: string
}

export function FilterSidebar({ hasLocation = false, showSort = true, openNowAvailable = true, className }: FilterSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [mobileOpen, setMobileOpen] = useState(false)

  const age = parseCSV(searchParams.get('age'))
  const facilities = parseCSV(searchParams.get('facilities'))
  const price = searchParams.get('price') || ''
  const special = parseCSV(searchParams.get('special'))
  const defaultSort = hasLocation ? 'distance' : 'rating'
  const sort = searchParams.get('sort') || defaultSort

  const totalActive = age.length + facilities.length + (price ? 1 : 0) + special.length

  function update(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, val] of Object.entries(changes)) {
      if (!val) params.delete(key)
      else params.set(key, val)
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })

    // GA tracking
    if (typeof window !== 'undefined' && (window as any).gtag) {
      ;(window as any).gtag('event', 'filter_applied', {
        filter_params: params.toString(),
      })
      ;(window as any).gtag('event', 'filter_used', {
        filter_params: params.toString(),
      })
    }
  }

  function toggleMulti(param: string, current: string[], key: string) {
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key]
    update({ [param]: next.join(',') || null })
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString())
    ;['age', 'facilities', 'price', 'special', 'sort'].forEach((k) => params.delete(k))
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const sortOptions = hasLocation ? SORT_OPTIONS_WITH_LOCATION : SORT_OPTIONS_NO_LOCATION

  const filterContent = (
    <div className="space-y-6">
      {showSort && (
        <FilterSection title="Sort By">
          <div className="flex flex-wrap gap-2">
            {sortOptions.map((opt) => (
              <ChipButton
                key={opt.key}
                label={opt.label}
                active={sort === opt.key}
                onClick={() => update({ sort: opt.key === defaultSort ? null : opt.key })}
              />
            ))}
          </div>
        </FilterSection>
      )}

      <FilterSection title="Age Group">
        {AGE_OPTIONS.map((opt) => (
          <CheckRow
            key={opt.key}
            name="age"
            label={opt.label}
            checked={age.includes(opt.key)}
            onChange={() => toggleMulti('age', age, opt.key)}
          />
        ))}
      </FilterSection>

      <FilterSection title="Facilities">
        {FACILITY_OPTIONS.map((opt) => (
          <CheckRow
            key={opt.key}
            name="facilities"
            label={opt.label}
            checked={facilities.includes(opt.key)}
            onChange={() => toggleMulti('facilities', facilities, opt.key)}
          />
        ))}
      </FilterSection>

      <FilterSection title="Price Range">
        {PRICE_OPTIONS.map((opt) => (
          <RadioRow
            key={opt.key}
            name="price-range"
            label={opt.label}
            checked={price === opt.key}
            onChange={() => update({ price: price === opt.key ? null : opt.key })}
          />
        ))}
      </FilterSection>

      <FilterSection title="Special">
        {SPECIAL_OPTIONS.filter((opt) => opt.key !== 'open-now' || openNowAvailable).map((opt) => (
          <CheckRow
            key={opt.key}
            name="special"
            label={opt.label}
            checked={special.includes(opt.key)}
            onChange={() => toggleMulti('special', special, opt.key)}
          />
        ))}
      </FilterSection>

      {totalActive > 0 && (
        <button
          onClick={clearAll}
          className="text-sm text-slate-500 hover:text-slate-900 underline"
        >
          Clear all filters
        </button>
      )}
    </div>
  )

  return (
    <>
      {/* Mobile: sticky collapsible bar */}
      <div className={cn('lg:hidden', className)}>
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="flex w-full items-center gap-2 text-sm font-medium text-slate-700"
        >
          <SlidersHorizontal className="w-4 h-4 text-purple-600 shrink-0" />
          <span>Filters &amp; Sort</span>
          {totalActive > 0 && (
            <span className="bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold leading-none">
              {totalActive}
            </span>
          )}
          <span className="ml-auto shrink-0">
            {mobileOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </span>
        </button>
        {mobileOpen && (
          <div className="mt-3 pt-3 border-t border-slate-100 max-h-[65vh] overflow-y-auto pr-1">
            {filterContent}
          </div>
        )}
      </div>

      {/* Desktop: full sidebar panel */}
      <div className={cn('hidden lg:block', className)}>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
              <SlidersHorizontal className="w-4 h-4 text-purple-600" />
              Filters
              {totalActive > 0 && (
                <span className="bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold">
                  {totalActive}
                </span>
              )}
            </h2>
            {totalActive > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Clear all
              </button>
            )}
          </div>
          {filterContent}
        </div>
      </div>
    </>
  )
}

// ─── Active filter chips bar (shows above results) ────────────────────────────

export function ActiveFilterBar({ className }: { className?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const age = parseCSV(searchParams.get('age'))
  const facilities = parseCSV(searchParams.get('facilities'))
  const price = searchParams.get('price')
  const special = parseCSV(searchParams.get('special'))

  const allActive = [
    ...age.map((k) => ({ param: 'age', val: k, label: AGE_OPTIONS.find((o) => o.key === k)?.label ?? k })),
    ...facilities.map((k) => ({ param: 'facilities', val: k, label: FACILITY_OPTIONS.find((o) => o.key === k)?.label ?? k })),
    ...(price ? [{ param: 'price', val: price, label: PRICE_OPTIONS.find((o) => o.key === price)?.label ?? price }] : []),
    ...special.map((k) => ({ param: 'special', val: k, label: SPECIAL_OPTIONS.find((o) => o.key === k)?.label ?? k })),
  ]

  if (allActive.length === 0) return null

  function removeFilter(param: string, val: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (param === 'price') {
      params.delete('price')
    } else {
      const current = parseCSV(params.get(param))
      const next = current.filter((v) => v !== val)
      if (next.length) params.set(param, next.join(','))
      else params.delete(param)
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {allActive.map(({ param, val, label }) => (
        <span
          key={`${param}-${val}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 border border-purple-200 rounded-full text-xs font-medium text-purple-800"
        >
          {label}
          <button
            onClick={() => removeFilter(param, val)}
            aria-label={`Remove ${label} filter`}
            className="hover:text-purple-600"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
    </div>
  )
}

// ─── Helpers & sub-components ─────────────────────────────────────────────────

function parseCSV(val: string | null): string[] {
  return (val || '').split(',').filter(Boolean)
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
        {title}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function ChipButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
        active
          ? 'bg-purple-600 text-white border-purple-600'
          : 'bg-white text-slate-700 border-slate-200 hover:border-purple-300 hover:text-purple-700'
      )}
    >
      {label}
    </button>
  )
}

function CheckRow({
  label,
  checked,
  onChange,
  name,
}: {
  label: string
  checked: boolean
  onChange: () => void
  name?: string
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none group">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        aria-label={label}
        className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
      />
      <span
        className={cn(
          'text-sm',
          checked
            ? 'text-slate-900 font-medium'
            : 'text-slate-600 group-hover:text-slate-800'
        )}
      >
        {label}
      </span>
    </label>
  )
}

function RadioRow({
  label,
  checked,
  onChange,
  name,
}: {
  label: string
  checked: boolean
  onChange: () => void
  name?: string
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none group">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        aria-label={label}
        className="w-4 h-4 border-slate-300 text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
      />
      <span
        className={cn(
          'text-sm',
          checked
            ? 'text-slate-900 font-medium'
            : 'text-slate-600 group-hover:text-slate-800'
        )}
      >
        {label}
      </span>
    </label>
  )
}
