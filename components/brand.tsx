import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Inline brand name — NOT all caps. Subtly highlights on hover.
 * Use inside body copy, e.g. "... backed by <BrandName /> ...".
 */
export function BrandName({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'group/brand cursor-default rounded px-0.5 font-semibold text-foreground transition-colors duration-200 hover:text-accent',
        className,
      )}
    >
      Afterstem<span className="text-accent">.ai</span>
    </span>
  )
}

/**
 * Logo lockup: the real Afterstem mark (navy/teal "A" road-and-arrow) in a
 * hand-drawn sticker frame, so it always reads cleanly whether it sits on
 * paper, chalkboard, or a photo. `variant="mark"` shows just the icon (for
 * tight spaces like a mobile nav), the default shows icon + handwritten name.
 */
export function BrandLogo({
  className,
  markClassName,
  variant = 'full',
}: {
  variant?: 'full' | 'mark'
  className?: string
  markClassName?: string
}) {
  return (
    <span className={cn('inline-flex items-center', className)}>
      {variant === 'full' ? (
        <Image
          src="/afterstem-full.png"
          alt="Afterstem.ai"
          width={720}
          height={190}
          className={cn('h-auto max-h-14 w-[204px] max-w-full object-contain object-left sm:h-16 sm:w-[232px]', markClassName)}
          priority
        />
      ) : (
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper shadow-sm', markClassName)}>
          <Image
            src="/afterstem-mark.png"
            alt="Afterstem.ai"
            width={220}
            height={220}
            className="h-full w-full object-contain p-1"
            priority
          />
        </span>
      )}
    </span>
  )
}
