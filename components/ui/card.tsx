import * as React from 'react'
import { cn } from '../../lib/utils'

/**
 * 卡片：全站统一的一种"容器"。
 * 强调这一点 —— 卡片**不加阴影**，靠 1px 暖灰边框与留白分层。
 * 阴影堆叠是模板感最重的来源之一。
 */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-box border border-[#e0d3bd] bg-base-100/70 text-[#3f332a]', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 px-5 pt-5', className)} {...props} />
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('font-serif-cn text-[17px] leading-snug text-[#3f332a]', className)}
      {...props}
    />
  )
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-[13px] text-[#8a7a68]', className)} {...props} />
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...props} />
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-3 px-5 pb-5', className)} {...props} />
}
