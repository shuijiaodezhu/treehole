import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

/** 徽标：两种就够 —— 实心火漆（要看见）与描边暖灰（补充说明）。 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] leading-normal',
  {
    variants: {
      variant: {
        wax: 'bg-[#a8563a] text-[#fdf8f0]',
        soft: 'bg-[#f1e9dc] text-[#6b5949]',
        outline: 'border border-[#e0d3bd] text-[#8a7a68]',
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
