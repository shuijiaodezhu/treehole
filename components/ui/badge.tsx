import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

/** 徽标：两种就够 —— 实心火漆（要看见）与描边暖灰（补充说明）。 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] leading-normal',
  {
    variants: {
      variant: {
        wax: 'bg-primary text-base-content/40',
        soft: 'bg-base-200 text-base-content',
        outline: 'border border-base-300 text-base-content/60',
      },
    },
    defaultVariants: { variant: 'soft' },
  },
)

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { badgeVariants }
