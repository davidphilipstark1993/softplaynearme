'use client'

import { useMemo, useState } from 'react'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ReviewItem {
  id: number
  reviewer_name: string
  rating: number
  comment: string
  created_at: string
}

interface ReviewSectionProps {
  initialReviews: ReviewItem[]
  venueId: number
  citySlug: string
  venueSlug: string
  /** Google's aggregate review count shown in the page header, so the empty state here can explain the difference instead of looking contradictory. */
  googleReviewCount?: number
}

function Stars({ value, className = 'w-4 h-4' }: { value: number; className?: string }) {
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${className} ${star <= value ? 'text-yellow-400 fill-current' : 'text-slate-200'}`}
        />
      ))}
    </div>
  )
}

export function ReviewSection({ initialReviews, venueId, citySlug, venueSlug, googleReviewCount }: ReviewSectionProps) {
  const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const average = useMemo(() => {
    if (reviews.length === 0) return 0
    const total = reviews.reduce((sum, review) => sum + review.rating, 0)
    return total / reviews.length
  }, [reviews])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venueId: venueId > 0 ? venueId : undefined,
          citySlug,
          venueSlug,
          reviewerName: name.trim(),
          reviewerEmail: email.trim() || undefined,
          rating,
          comment: comment.trim(),
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to submit review')
      }

      setMessage(payload.message || 'Review submitted successfully')
      setName('')
      setEmail('')
      setRating(5)
      setComment('')

      const query = venueId > 0
        ? `/api/reviews?venueId=${venueId}`
        : `/api/reviews?citySlug=${encodeURIComponent(citySlug)}&venueSlug=${encodeURIComponent(venueSlug)}`
      const refreshResponse = await fetch(query)
      if (refreshResponse.ok) {
        const fresh = await refreshResponse.json()
        if (Array.isArray(fresh)) {
          setReviews(fresh)
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to submit review')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <h2 className="font-semibold text-lg mb-2">
        Reviews {reviews.length > 0 && `(${reviews.length})`}
      </h2>

      {reviews.length > 0 ? (
        <div className="mb-5 rounded-lg bg-slate-50 border border-slate-200 p-4">
          <div className="flex items-center gap-2">
            <Stars value={Math.round(average)} className="w-5 h-5" />
            <span className="font-semibold text-slate-800">{average.toFixed(1)} / 5</span>
          </div>
          <p className="text-sm text-slate-600 mt-1">Based on {reviews.length} review{reviews.length === 1 ? '' : 's'}.</p>
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-slate-500">No reviews yet on Soft Play Near Me. Be the first to review.</p>
          {googleReviewCount != null && googleReviewCount > 0 && (
            <p className="text-slate-400 text-sm mt-1">
              (The rating above is from {googleReviewCount.toLocaleString('en-GB')} Google reviews — separate from reviews left here.)
            </p>
          )}
        </div>
      )}

      {reviews.length > 0 && (
        <div className="space-y-4 mb-8">
          {reviews.map((review) => (
            <div key={review.id} className="border-b border-slate-100 pb-4 last:border-0">
              <div className="flex items-center justify-between mb-2 gap-4">
                <span className="font-semibold">{review.reviewer_name}</span>
                <Stars value={review.rating} />
              </div>
              <p className="text-slate-600 text-sm">{review.comment}</p>
              <p className="text-slate-400 text-xs mt-2">
                {new Date(review.created_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 border-t border-slate-100 pt-6">
        <h3 className="font-semibold text-slate-900">Leave a review</h3>

        <div>
          <label className="text-sm font-medium text-slate-700 block mb-2">Your rating</label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="p-1"
                aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
              >
                <Star className={`w-6 h-6 ${star <= rating ? 'text-yellow-400 fill-current' : 'text-slate-300'}`} />
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="reviewer-name" className="text-sm font-medium text-slate-700 block mb-1">Name</label>
            <Input
              id="reviewer-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={80}
            />
          </div>
          <div>
            <label htmlFor="reviewer-email" className="text-sm font-medium text-slate-700 block mb-1">Email (optional)</label>
            <Input
              id="reviewer-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              maxLength={120}
            />
          </div>
        </div>

        <div>
          <label htmlFor="review-comment" className="text-sm font-medium text-slate-700 block mb-1">Your review</label>
          <textarea
            id="review-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            required
            minLength={10}
            maxLength={1000}
            rows={4}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-xs focus-visible:border-purple-500 focus-visible:ring-2 focus-visible:ring-purple-200 focus-visible:outline-none"
          />
        </div>

        {message && <p className="text-sm text-green-700">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={submitting} className="bg-purple-600 hover:bg-purple-700">
          {submitting ? 'Submitting...' : 'Submit review'}
        </Button>
      </form>
    </div>
  )
}
