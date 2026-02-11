import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalize a single day's opening hours value into { open, close } strings.
 * Handles both object format ({ open: "09:30", close: "17:00" }) and
 * string format ("09:30 - 17:00" or "closed").
 */
function normalizeDayHours(value: unknown): { open: string; close: string } | null {
  if (!value) return null
  if (typeof value === 'object' && value !== null && 'open' in value && 'close' in value) {
    const obj = value as { open?: string; close?: string }
    if (!obj.open || !obj.close) return null
    return { open: obj.open, close: obj.close }
  }
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'closed') return null
    const match = value.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/)
    if (match) return { open: match[1], close: match[2] }
    return null
  }
  return null
}

/**
 * Check if a venue is currently open based on opening hours
 */
export function isOpenNow(openingHours: Record<string, unknown> | null): boolean {
  if (!openingHours) return false

  const now = new Date()
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const today = days[now.getDay()]
  const hours = normalizeDayHours(openingHours[today])

  if (!hours || hours.open === 'closed') return false

  const currentTime = now.getHours() * 100 + now.getMinutes()
  const openTime = parseInt(hours.open.replace(':', ''))
  const closeTime = parseInt(hours.close.replace(':', ''))

  return currentTime >= openTime && currentTime < closeTime
}

/**
 * Format opening hours for display
 */
export function formatOpeningHours(openingHours: Record<string, unknown> | null): string {
  if (!openingHours) return 'Hours not available'

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const now = new Date()
  const today = days[(now.getDay() + 6) % 7] // Adjust for Monday start
  const hours = normalizeDayHours(openingHours[today])

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
