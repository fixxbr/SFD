'use client'

import { cn } from '@/lib/utils'

/**
 * A hand-placed photo/card wrapper: a gentle resting tilt that straightens
 * and lifts on hover, like picking a taped-in photo off the page. No mouse
 * tracking, no glossy 3D — kept intentionally simple and tactile.
 */
export function TiltCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
  max?: number
}) {
  return (
    <div
      className={cn(
        'relative transition-transform duration-300 ease-out hover:-translate-y-1 hover:rotate-0',
        className,
      )}
    >
      {children}
    </div>
  )
}
