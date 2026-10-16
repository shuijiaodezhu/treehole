'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * 弹窗：交给 Radix 管（焦点陷阱、Esc 关闭、aria、滚动锁都比手搓可靠）。
 * 动画走 globals.css 里那两个 keyframes（不引 tailwindcss-animate）。

 * 配色仍是暖纸：遮罩用暖棕的极淡一层，不是纯黑。
 */
export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export const DialogPortal = DialogPrimitive.Portal

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'dsh-overlay fixed inset-0 z-50 bg-[rgba(63,51,42,0.35)] backdrop-blur-[2px]',
      className,
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'dsh-content fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md',
        '-translate-x-1/2 -translate-y-1/2 rounded-box border border-[#e0d3bd] bg-[#fdf8f0] p-6',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className="absolute right-4 top-4 rounded-md p-1 text-[#8a7a68] transition hover:bg-[#f1e9dc] hover:text-[#3f332a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a8563a]/30"
        aria-label="关闭"
      >
        <X className="h-4 w-4" strokeWidth={1.8} />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 flex flex-col gap-1.5 pr-8', className)} {...props} />
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
  )
}

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('font-serif-cn text-[17px] text-[#3f332a]', className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-[13px] leading-relaxed text-[#8a7a68]', className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName
