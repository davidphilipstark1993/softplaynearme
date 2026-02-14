import { promises as fs } from 'fs'
import path from 'path'

export interface StoredReview {
  id: number
  venueId?: number
  citySlug: string
  venueSlug: string
  reviewer_name: string
  reviewer_email?: string | null
  rating: number
  comment: string
  approved: boolean
  created_at: string
}

const REVIEWS_FILE = path.join(process.cwd(), 'data', 'reviews.json')

async function ensureReviewsFile() {
  const dir = path.dirname(REVIEWS_FILE)
  await fs.mkdir(dir, { recursive: true })
  try {
    await fs.access(REVIEWS_FILE)
  } catch {
    await fs.writeFile(REVIEWS_FILE, '[]\n', 'utf8')
  }
}

async function readAllReviews(): Promise<StoredReview[]> {
  await ensureReviewsFile()
  const raw = await fs.readFile(REVIEWS_FILE, 'utf8')

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeAllReviews(reviews: StoredReview[]) {
  await ensureReviewsFile()
  await fs.writeFile(REVIEWS_FILE, `${JSON.stringify(reviews, null, 2)}\n`, 'utf8')
}

export interface ReviewLookup {
  venueId?: number
  citySlug?: string
  venueSlug?: string
}

export async function getStoredReviews(lookup: ReviewLookup): Promise<StoredReview[]> {
  const all = await readAllReviews()

  return all
    .filter((review) => review.approved)
    .filter((review) => {
      if (lookup.venueId && review.venueId) {
        return review.venueId === lookup.venueId
      }

      if (lookup.citySlug && lookup.venueSlug) {
        return review.citySlug === lookup.citySlug && review.venueSlug === lookup.venueSlug
      }

      return false
    })
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
}

export interface CreateStoredReviewInput {
  venueId?: number
  citySlug: string
  venueSlug: string
  reviewerName: string
  reviewerEmail?: string
  rating: number
  comment: string
  approved?: boolean
}

export async function addStoredReview(input: CreateStoredReviewInput): Promise<StoredReview> {
  const all = await readAllReviews()
  const maxId = all.reduce((max, item) => (item.id > max ? item.id : max), 0)

  const review: StoredReview = {
    id: maxId + 1,
    venueId: input.venueId,
    citySlug: input.citySlug,
    venueSlug: input.venueSlug,
    reviewer_name: input.reviewerName,
    reviewer_email: input.reviewerEmail || null,
    rating: input.rating,
    comment: input.comment,
    approved: input.approved ?? true,
    created_at: new Date().toISOString(),
  }

  all.push(review)
  await writeAllReviews(all)

  return review
}
