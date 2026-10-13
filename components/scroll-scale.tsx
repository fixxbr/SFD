'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Wraps a section and continuously scales/tilts it in 3D space based on scroll
 * position: it zooms in and rises as it enters the viewport, sits at full
 * scale through the middle, then gently zooms back out as it leaves. Applies
 * a cheap CSS transform driven by rAF-throttled scroll math (not IntersectionObserver
 * one-shot), which is what makes the "in AND out" effect possible.
 */
export function ScrollScale({
  children,
  className,
  intensity = 1,
  as: Tag = 'div',
}: {
  children: React.ReactNode
  className?: string
  /** 0-1, how strong the scale/rotate range is. */
  intensity?: number
  as?: React.ElementType
}) {
  const ref = useRef<HTMLElement | null>(null)
  const [style, setStyle] = useState<React.CSSProperties>({})
  const reduced = useRef(false)

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced.current) return

    const el = ref.current
    if (!el) return

    let raf = 0
    let ticking = false

    const update = () => {
      ticking = false
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight || 1
      const center = rect.top + rect.height / 2
      // -1 when centered above viewport, 0 when centered in viewport, 1 when centered below
      const dist = (center - vh / 2) / (vh / 2 + rect.height / 2)
      const clamped = Math.max(-1, Math.min(1, dist))
      const progress = 1 - Math.abs(clamped) // 1 at center, 0 at edges

      const minScale = 1 - 0.14 * intensity
      const scale = minScale + (1 - minScale) * progress
      const rotateX = clamped * -4 * intensity
      const translateY = Math.abs(clamped) * 18 * intensity
      const opacity = 0.55 + 0.45 * progress

      setStyle({
        transform: `perspective(1400px) rotateX(${rotateX}deg) translateY(${translateY}px) scale(${scale})`,
        opacity,
      })
    }

    const onScroll = () => {
      if (!ticking) {
        ticking = true
        raf = requestAnimationFrame(update)
      }
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [intensity])

  return (
    <Tag
      ref={ref as never}
      className={cn('will-change-transform [transform-style:preserve-3d]', className)}
      style={style}
    >
      {children}
    </Tag>
  )
}
