'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { displayPhotoUrl } from '@/lib/imageUtils'

interface Photo {
  id: number
  url: string
  alt_text: string
  is_primary: boolean
}

interface PhotoGalleryProps {
  photos: Photo[]
  venueName: string
}

export function PhotoGallery({ photos, venueName }: PhotoGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  if (!photos || photos.length === 0) {
    return null
  }

  const openLightbox = (index: number) => {
    setCurrentIndex(index)
    setLightboxOpen(true)
    document.body.style.overflow = 'hidden'
  }

  const closeLightbox = () => {
    setLightboxOpen(false)
    document.body.style.overflow = 'unset'
  }

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1))
  }

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') closeLightbox()
    if (e.key === 'ArrowLeft') goToPrevious()
    if (e.key === 'ArrowRight') goToNext()
  }

  return (
    <>
      {/* Photo Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        {photos.slice(0, 8).map((photo, index) => (
          <button
            key={photo.id}
            onClick={() => openLightbox(index)}
            className={cn(
              'relative overflow-hidden rounded-lg cursor-pointer group',
              'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2',
              // A lone photo spans the full width as a banner rather than a half-width square
              photos.length === 1 ? 'col-span-2 md:col-span-4 aspect-[4/3] md:aspect-[21/9]' : 'aspect-square',
              index === 0 && photos.length > 1 && 'col-span-2 row-span-2'
            )}
          >
            <Image
              src={displayPhotoUrl(photo.url)}
              alt={photo.alt_text || `${venueName} photo ${index + 1}`}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              // The banner sits inside the page's side padding, so it is never the full viewport wide
              sizes={photos.length === 1 ? '(max-width: 1280px) calc(100vw - 32px), 1216px' : index === 0 ? '(max-width: 768px) 100vw, 50vw' : '(max-width: 768px) 50vw, 25vw'}
              priority={index === 0}
              quality={photos.length === 1 ? 65 : undefined}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            {index === 7 && photos.length > 8 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white text-lg font-semibold">
                  +{photos.length - 8} more
                </span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
          onKeyDown={handleKeyDown}
          role="dialog"
          aria-modal="true"
          aria-label={`Photo gallery for ${venueName}`}
          tabIndex={0}
        >
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/10 z-10"
            onClick={closeLightbox}
            aria-label="Close gallery"
          >
            <X className="h-6 w-6" />
          </Button>

          {/* Previous button */}
          {photos.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 z-10"
              onClick={(e) => {
                e.stopPropagation()
                goToPrevious()
              }}
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
          )}

          {/* Main image */}
          <div
            className="relative max-w-4xl max-h-[80vh] w-full h-full mx-16"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={displayPhotoUrl(photos[currentIndex].url)}
              alt={photos[currentIndex].alt_text || `${venueName} photo ${currentIndex + 1}`}
              fill
              className="object-contain"
              sizes="100vw"
              priority
            />
          </div>

          {/* Next button */}
          {photos.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 z-10"
              onClick={(e) => {
                e.stopPropagation()
                goToNext()
              }}
              aria-label="Next photo"
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          )}

          {/* Counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm">
            {currentIndex + 1} / {photos.length}
          </div>

          {/* Thumbnails */}
          {photos.length > 1 && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-2 max-w-xl overflow-x-auto py-2 px-4">
              {photos.map((photo, index) => (
                <button
                  key={photo.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    setCurrentIndex(index)
                  }}
                  // The thumbnail image is decorative (alt=""), so the button
                  // needs its own accessible name — without one it announced
                  // as an unlabelled button.
                  aria-label={`View photo ${index + 1} of ${photos.length}`}
                  aria-current={index === currentIndex}
                  className={cn(
                    'relative w-12 h-12 flex-shrink-0 rounded overflow-hidden',
                    index === currentIndex && 'ring-2 ring-white'
                  )}
                >
                  <Image
                    src={displayPhotoUrl(photo.url)}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
