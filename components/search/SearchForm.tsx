'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, MapPin, Loader2 } from 'lucide-react'
import { isValidUKPostcode, RADIUS_OPTIONS } from '@/lib/geo'
import { cn } from '@/lib/utils'

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
  const router = useRouter()
  const [postcode, setPostcode] = useState(defaultValue)
  const [radius, setRadius] = useState(defaultRadius)
  const [isLocating, setIsLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!postcode.trim()) {
      setError('Please enter a postcode or city')
      return
    }

    // Check if it looks like a postcode
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
          maximumAge: 300000, // 5 minutes
        })
      })

      const { latitude, longitude } = position.coords

      // Navigate directly to search with coordinates
      if (onSearch) {
        // For custom handlers, we'd need to handle coords differently
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

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className={cn('flex gap-2', className)}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Enter postcode..."
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            className="pl-10"
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
        {/* Postcode input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Enter postcode or city..."
            value={postcode}
            onChange={(e) => {
              setPostcode(e.target.value)
              setError(null)
            }}
            className="pl-11 h-12 text-base"
            aria-label="Search by postcode or city"
          />
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
