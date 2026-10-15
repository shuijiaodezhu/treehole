'use client'

import { Toaster as SonnerToaster } from 'sonner'

/**
 * 全局提示（toast）：成功、失败、复制的反馈都走这里。
 * 之前各处都是"页面里插一行红字"，位置、消失时机、样式各不相同；
 * 统一成一处之后，"做了事有没有成"变得一眼可见。
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      closeButton
      toastOptions={{
        style: {
          background: '#fdf8f0',
          border: '1px solid #e0d3bd',
          color: '#3f332a',
          borderRadius: '12px',
          fontSize: '13px',
        },
        className: 'font-serif-cn',
      }}
    />
  )
}
