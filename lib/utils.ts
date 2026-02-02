import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Check if a venue is currently open based on opening hours
 */
export function isOpenNow(openingHours: Record<string, { open: string; close: string }> | null): boolean {
  if (!openingHours) return false

  const now = new Date()
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const today = days[now.getDay()]
  const hours = openingHours[today]

  if (!hours || hours.open === 'closed') return false

  const currentTime = now.getHours() * 100 + now.getMinutes()
  const openTime = parseInt(hours.open.replace(':', ''))
  const closeTime = parseInt(hours.close.replace(':', ''))

  return currentTime >= openTime && currentTime < closeTime
}

/**
 * Format opening hours for display
 */
export function formatOpeningHours(openingHours: Record<string, { open: string; close: string }> | null): string {
  if (!openingHours) return 'Hours not available'

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const now = new Date()
  const today = days[(now.getDay() + 6) % 7] // Adjust for Monday start
  const hours = openingHours[today]

  if (!hours || hours.open === 'closed') return 'Closed today'

  return `${hours.open} - ${hours.close}`
}

/**
 * Generate slug from string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
