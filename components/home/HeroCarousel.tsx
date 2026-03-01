'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface Slide {
  src: string
  alt: string
  label: string
}

const SLIDES: Slide[] = [
  {
    src: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=1600&q=80',
    alt: 'Children enjoying colourful indoor soft play climbing equipment',
    label: 'Safe Indoor Adventures',
  },
  {
    src: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=1600&q=80',
    alt: 'Toddler ball pit with bright soft play toys',
    label: 'Toddler-Friendly Zones',
  },
  {
    src: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=1600&q=80',
    alt: 'Soft play party setup for children birthday celebrations',
    label: 'Birthday Party Venues',
  },
  {
    src: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1600&q=80',
    alt: 'Parent relaxing in cafe while children play indoors',
    label: 'Parent-Friendly Cafes',
  },
]

export function HeroCarousel() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % SLIDES.length)
    }, 4500)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-xl">
      <div className="relative h-64 sm:h-80 md:h-96">
        {SLIDES.map((slide, slideIndex) => (
          <Image
            key={`${slide.src}-${slideIndex}`}
            src={slide.src}
            alt={slide.alt}
            fill
            priority={slideIndex === 0}
            className={cn(
              'object-cover transition-opacity duration-700',
              index === slideIndex ? 'opacity-100' : 'opacity-0'
            )}
            sizes="(max-width: 768px) 100vw, 1200px"
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
        <p className="absolute bottom-4 left-4 rounded-md bg-black/35 px-3 py-1 text-xs font-semibold tracking-wide text-white">
          {SLIDES[index].label}
        </p>
      </div>
      <div className="absolute bottom-4 right-4 flex gap-1.5">
        {SLIDES.map((_, dotIndex) => (
          <button
            key={dotIndex}
            type="button"
            onClick={() => setIndex(dotIndex)}
            aria-label={`Show slide ${dotIndex + 1}`}
            className={cn(
              'h-2.5 w-2.5 rounded-full border border-white/70 transition-all',
              index === dotIndex ? 'bg-white' : 'bg-white/30'
            )}
          />
        ))}
      </div>
    </div>
  )
}
