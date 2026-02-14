'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, MapPin, Loader2 } from 'lucide-react'
import { isValidUKPostcode, RADIUS_OPTIONS } from '@/lib/geo'
import { cn } from '@/lib/utils'
import { cities } from '@/lib/venues'
import { getStaticTowns } from '@/lib/staticVenues'

// Build autocomplete list from cities config + static towns
const AUTOCOMPLETE_ITEMS = (() => {
  const items = new Map<string, { label: string; slug: string }>()
  for (const city of cities) {
    items.set(city.slug, { label: `${city.name}, ${city.county}`, slug: city.slug })
  }
  for (const town of getStaticTowns()) {
    if (!items.has(town.slug)) {
      items.set(town.slug, { label: town.name, slug: town.slug })
    }
  }
  return Array.from(items.values())
})()

interface SearchFormProps {
  defaultValue?: string
  defaultRadius?: number
  className?: string
  onSearch?: (postcode: string, radius: number) => void
  showRadius?: boolean
  compact?: boolean
}

export function SearchForm({
  defaultValue = '',
  defaultRadius = 10,
  className,
  onSearch,
  showRadius = true,
  compact = false,
}: SearchFormProps) {
  const readableInputClasses =
    'bg-white border border-slate-200 text-slate-900 placeholder:text-slate-500 focus-visible:border-purple-500 focus-visible:ring-2 focus-visible:ring-purple-500/40 ' +
    '[&:-webkit-autofill]:[-webkit-text-fill-color:#0f172a] [&:-webkit-autofill]:[box-shadow:0_0_0px_1000px_white_inset] [&:-webkit-autofill:hover]:[-webkit-text-fill-color:#0f172a] [&:-webkit-autofill:focus]:[-webkit-text-fill-color:#0f172a]'

  const router = useRouter()
  const [postcode, setPostcode] = useState(defaultValue)
  const [radius, setRadius] = useState(defaultRadius)
  const [isLocating, setIsLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<typeof AUTOCOMPLETE_ITEMS>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const suggestionsRef = useRef<HTMLUListElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Filter suggestions based on input
  const updateSuggestions = useCallback((value: string) => {
    const trimmed = value.trim().toLowerCase()
    if (trimmed.length < 2 || isValidUKPostcode(trimmed)) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    const matches = AUTOCOMPLETE_ITEMS.filter(item =>
      item.label.toLowerCase().includes(trimmed)
    ).slice(0, 5)

    setSuggestions(matches)
    setShowSuggestions(matches.length > 0)
    setSelectedIndex(-1)
  }, [])

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selectSuggestion = (item: (typeof AUTOCOMPLETE_ITEMS)[0]) => {
    setPostcode(item.label.split(',')[0]) // Just the city name
    setShowSuggestions(false)
    router.push(`/soft-play/${item.slug}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      selectSuggestion(suggestions[selectedIndex])
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setShowSuggestions(false)

    if (!postcode.trim()) {
      setError('Please enter a postcode or city')
      return
    }

    // Track search event
    if (typeof window !== 'undefined' && (window as any).gtag) {
      ;(window as any).gtag('event', 'search', { search_term: postcode.trim() })
    }

    const cleaned = postcode.trim().replace(/\s/g, '')
    if (cleaned.length >= 5 && !isValidUKPostcode(cleaned)) {
      // Might be a city name, proceed anyway
    }

    if (onSearch) {
      onSearch(postcode.trim(), radius)
    } else {
      const params = new URLSearchParams({
        q: postcode.trim(),
        radius: radius.toString(),
      })
      router.push(`/search?${params.toString()}`)
    }
  }

  const handleGeolocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      return
    }

    setIsLocating(true)
    setError(null)

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        })
      })

      const { latitude, longitude } = position.coords

      if (onSearch) {
        setError('Location found - please enter a postcode')
      } else {
        const params = new URLSearchParams({
          lat: latitude.toFixed(6),
          lng: longitude.toFixed(6),
          radius: radius.toString(),
        })
        router.push(`/search?${params.toString()}`)
      }
    } catch (err) {
      if (err instanceof GeolocationPositionError) {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Location access denied. Please enter a postcode.')
            break
          case err.POSITION_UNAVAILABLE:
            setError('Location unavailable. Please enter a postcode.')
            break
          case err.TIMEOUT:
            setError('Location request timed out. Please enter a postcode.')
            break
        }
      } else {
        setError('Failed to get location. Please enter a postcode.')
      }
    } finally {
      setIsLocating(false)
    }
  }, [radius, router, onSearch])

  const suggestionsList = showSuggestions && suggestions.length > 0 ? (
    <ul
      ref={suggestionsRef}
      className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
      role="listbox"
    >
      {suggestions.map((item, i) => (
        <li
          key={item.slug}
          role="option"
          aria-selected={i === selectedIndex}
          className={cn(
            'px-4 py-3 cursor-pointer text-sm flex items-center gap-2 text-slate-900',
            i === selectedIndex ? 'bg-purple-50 text-purple-700' : 'hover:bg-slate-50'
          )}
          onMouseDown={() => selectSuggestion(item)}
        >
          <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
          {item.label}
        </li>
      ))}
    </ul>
  ) : null

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className={cn('flex gap-2', className)}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Enter postcode..."
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            className={cn('pl-10', readableInputClasses)}
          />
        </div>
        <Button type="submit">
          Search
        </Button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4', className)}>
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Postcode/city input with autocomplete */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Enter postcode or city..."
            value={postcode}
            onChange={(e) => {
              setPostcode(e.target.value)
              setError(null)
              updateSuggestions(e.target.value)
            }}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true)
            }}
            onKeyDown={handleKeyDown}
            className={cn('pl-11 h-12 text-base', readableInputClasses)}
            aria-label="Search by postcode or city"
            aria-expanded={showSuggestions}
            aria-autocomplete="list"
            autoComplete="off"
          />
          {suggestionsList}
        </div>

        {/* Use my location button */}
        <Button
          type="button"
          variant="outline"
          onClick={handleGeolocation}
          disabled={isLocating}
          className="h-12 whitespace-nowrap"
        >
          {isLocating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MapPin className="h-4 w-4" />
          )}
          <span className="hidden sm:inline ml-2">
            {isLocating ? 'Locating...' : 'Use my location'}
          </span>
        </Button>

        {/* Search button */}
        <Button type="submit" size="lg" className="h-12">
          <Search className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Search</span>
        </Button>
      </div>

      {/* Radius selection */}
      {showRadius && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Within:</span>
          {RADIUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRadius(option.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                radius === option.value
                  ? 'bg-purple-600 text-white'
                  : 'bg-muted hover:bg-muted/80 text-foreground'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
