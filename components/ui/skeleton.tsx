import { cn } from '../../lib/utils'

/**
 * 骨架屏：加载时先占住版位，内容到位再换掉。
 * 比一个转圈更"高级"的地方在于：页面不会跳。
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-[#ece3d4]', className)} {...props} />
}
