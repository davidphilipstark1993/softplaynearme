'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SortOption = 'distance' | 'rating' | 'price_low' | 'price_high' | 'name'

interface SortDropdownProps {
  value: SortOption
  onChange: (value: SortOption) => void
  hasLocation?: boolean
  className?: string
}

const SORT_OPTIONS: { value: SortOption; label: string; requiresLocation?: boolean }[] = [
  { value: 'distance', label: 'Distance', requiresLocation: true },
  { value: 'rating', label: 'Rating' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'name', label: 'Name (A-Z)' },
]

export function SortDropdown({
  value,
  onChange,
  hasLocation = false,
  className,
}: SortDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const availableOptions = SORT_OPTIONS.filter(
    (opt) => !opt.requiresLocation || hasLocation
  )

  const currentOption = availableOptions.find((opt) => opt.value === value) || availableOptions[0]

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between min-w-[180px]"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Sort by:</span>
          <span>{currentOption.label}</span>
        </span>
        <ChevronDown
          className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')}
        />
      </Button>

      {isOpen && (
        <div
          className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 py-1"
          role="listbox"
        >
          {availableOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
              className={cn(
                'w-full px-4 py-2 text-left text-sm flex items-center justify-between',
                'hover:bg-muted transition-colors',
                option.value === value && 'bg-purple-50 text-purple-700'
              )}
              role="option"
              aria-selected={option.value === value}
            >
              {option.label}
              {option.value === value && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Simple inline sort tabs for mobile
export function SortTabs({
  value,
  onChange,
  hasLocation = false,
  className,
}: SortDropdownProps) {
  const availableOptions = SORT_OPTIONS.filter(
    (opt) => !opt.requiresLocation || hasLocation
  ).slice(0, 3) // Show only top 3 options for mobile

  return (
    <div className={cn('flex gap-1 p-1 bg-muted rounded-lg', className)}>
      {availableOptions.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
            option.value === value
              ? 'bg-white shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
