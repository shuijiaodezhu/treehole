import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 合并 className：clsx 处理条件，tailwind-merge 去掉互相冲突的类
 * （比如同时写了 px-4 和 px-6，只留后一个）。
 * shadcn/ui 那一套的约定，几乎所有组件都会用到它。
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
