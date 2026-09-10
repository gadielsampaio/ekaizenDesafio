import type { ComponentProps } from 'react'
import { cn } from '@/shared/lib/utils'

export function Spinner({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      aria-hidden="true"
      data-slot="spinner"
      focusable="false"
      viewBox="0 0 24 24"
      className={cn('size-4 animate-spin motion-reduce:animate-none', className)}
      {...props}
    >
      <circle className="opacity-25" cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-80" d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
    </svg>
  )
}
