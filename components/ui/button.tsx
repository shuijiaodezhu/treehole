'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

/**
 * 按钮：按 shadcn/ui 的写法（cva 管变体 + cn 合并类 + forwardRef 保住可访问性），
 * 但配色换成这个站的暖色系 —— 只有 default 用火漆红，其余都是低调的描边与幽灵。
 *
 * 为什么要引入这一套：
 *   手搓 button 时，每个页面的高度、圆角、悬停、focus 圈都略有差别，
 *   一处一处对不齐就显出"手工味"。有了变体表，全站按钮只有这四种形态。
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4ebdd] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-base-content/40 hover:bg-primary',
        outline: 'border border-base-300 bg-base-100/60 text-base-content hover:border-base-300 hover:bg-base-100',
        ghost: 'text-base-content/60 hover:bg-base-200 hover:text-base-content',
        link: 'text-base-content underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5 text-sm',
        sm: 'h-9 px-3.5 text-[13px]',
        lg: 'h-11 px-6 text-[15px]',
        icon: 'h-9 w-9 rounded-full',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
)
Button.displayName = 'Button'

export { buttonVariants }
