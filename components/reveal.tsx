'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Fades + slides its children in when scrolled into view.
 * `delay` (ms) staggers entrance for grids/lists.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  variant = 'up',
  as: Tag = 'div',
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  variant?: 'up' | 'zoom' | 'pop'
  as?: React.ElementType
}) {
  const base = variant === 'zoom' ? 'reveal-zoom' : variant === 'pop' ? 'reveal-pop' : 'reveal'
  const ref = useRef<HTMLElement | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref as never}
      className={cn(base, shown && 'reveal-in', className)}
      style={{ animationDelay: shown ? `${delay}ms` : undefined }}
    >
      {children}
    </Tag>
  )
}
