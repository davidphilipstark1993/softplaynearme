import { z } from 'zod'
import { ALL_PLACEMENTS, PLACEMENT_KEYS } from './placements'

const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => {
    try {
      const u = new URL(v)
      return u.protocol === 'https:' || u.protocol === 'http:'
    } catch {
      return false
    }
  }, 'Destination must be a full http(s) URL, e.g. https://listentruecrime.com')

/** Images must be ones we uploaded ourselves (Vercel Blob), never arbitrary hotlinks. */
const blobImageUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => {
    try {
      const u = new URL(v)
      return u.protocol === 'https:' && u.hostname.endsWith('.public.blob.vercel-storage.com')
    } catch {
      return false
    }
  }, 'Image must be uploaded through the advert form')

const isoOrNull = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || !Number.isNaN(Date.parse(v)), 'Invalid date')

export const adInputSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(120),
    description: z.string().trim().max(300).default(''),
    ctaText: z.string().trim().min(1, 'Button text is required').max(40),
    destinationUrl: httpUrl,
    imageUrl: blobImageUrl.nullable().optional().transform((v) => v ?? null),
    imageAlt: z.string().trim().max(200).default(''),
    advertiserName: z.string().trim().min(1).max(120),
    advertiserType: z.enum(['house', 'sponsor']),
    utmCampaign: z
      .string()
      .trim()
      .toLowerCase()
      .max(80)
      .regex(/^[a-z0-9_-]*$/, 'Campaign may only contain letters, numbers, - and _')
      .default(''),
    status: z.enum(['draft', 'active', 'archived']),
    startsAt: isoOrNull,
    endsAt: isoOrNull,
    priority: z.number().int().min(0).max(100),
    placements: z
      .array(z.string())
      .refine((arr) => arr.every((p) => p === ALL_PLACEMENTS || PLACEMENT_KEYS.includes(p)), 'Unknown placement')
      .transform((arr) => (arr.includes(ALL_PLACEMENTS) ? [ALL_PLACEMENTS] : Array.from(new Set(arr)))),
    citySlugs: z.array(z.string().regex(/^[a-z0-9-]{1,60}$/)).max(200).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.startsAt && v.endsAt && Date.parse(v.endsAt) <= Date.parse(v.startsAt)) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'End date must be after the start date' })
    }
    if (v.imageUrl && !v.imageAlt) {
      ctx.addIssue({ code: 'custom', path: ['imageAlt'], message: 'Alt text is required for the image' })
    }
    if (v.status === 'active') {
      if (!v.imageUrl) ctx.addIssue({ code: 'custom', path: ['imageUrl'], message: 'Upload artwork before activating' })
      if (v.placements.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['placements'], message: 'Choose at least one placement before activating' })
      }
    }
  })

export type AdInput = z.infer<typeof adInputSchema>

export function firstIssue(err: z.ZodError): string {
  const issue = err.issues[0]
  const path = issue.path.length ? `${issue.path.join('.')}: ` : ''
  return `${path}${issue.message}`
}
