'use client'

import { useRef, useState } from 'react'
import { motion, useMotionTemplate, useMotionValue, useSpring } from 'motion/react'
import type { ReactElement, ReactNode } from 'react'

/**
 * 3D 跟随倾斜的卡片
 *
 * 做法（都是 CSS 3D + motion 的动效值，不需要 three.js 那种大依赖）：
 *   · 指针位置 → useMotionValue → useSpring 平滑 → rotateX / rotateY
 *   · 卡片轻微"朝鼠标那一边转"，像一块被手指按着的硬纸
 *   · 同时有一道**跟随指针的柔光**（radial-gradient 用 motion template 拼），
 *     这是让它看起来有厚度、而不是一张平面图的关键
 *   · 指针离开 → 回正（spring 自然回弹，不要瞬移）
 *
 * 两个克制的地方（不然就成特效炫技了）：
 *   · 倾斜角度很小（默认 6 度）—— 大了会晕，也不像纸
 *   · 只在**精确指针**（鼠标/触控板）上启用；手机上直接不倾斜
 *     （手机上倾斜会跟滚动打架，得不偿失）
 */
export function TiltCard({
  children,
  className,
  max = 6,
}: {
  children: ReactNode
  className?: string
  max?: number
}): ReactElement {
  const ref = useRef<HTMLDivElement>(null)
  const [hovering, setHovering] = useState(false)

  // 指针在卡片内的相对位置（-0.5 ~ 0.5）
  const px = useMotionValue(0)
  const py = useMotionValue(0)

  const spring = { stiffness: 220, damping: 22, mass: 0.6 }
  const rotateX = useSpring(useMotionValue(0), spring)
  const rotateY = useSpring(useMotionValue(0), spring)

  // 柔光的位置（百分比）
  const glowX = useSpring(useMotionValue(50), { stiffness: 180, damping: 20 })
  const glowY = useSpring(useMotionValue(50), { stiffness: 180, damping: 20 })
  const glow = useMotionTemplate`radial-gradient(240px circle at ${glowX}% ${glowY}%, rgba(168,86,58,0.10), transparent 65%)`

  function canTilt() {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!canTilt() || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    px.set(x - 0.5)
    py.set(y - 0.5)
    rotateY.set(px.get() * max * 2)
    rotateX.set(-py.get() * max * 2)
    glowX.set(x * 100)
    glowY.set(y * 100)
  }

  function onPointerEnter() {
    if (canTilt()) setHovering(true)
  }

  function onPointerLeave() {
    setHovering(false)
    px.set(0)
    py.set(0)
    rotateX.set(0)
    rotateY.set(0)
    glowX.set(50)
    glowY.set(50)
  }

  return (
    <div style={{ perspective: '900px' }} className="h-full">
      <motion.div
        ref={ref}
        onPointerMove={onPointerMove}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
        className={className}
      >
        {/* 跟随指针的柔光层：它让卡片"有厚度" */}
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-box opacity-0 transition-opacity duration-300"
          style={{ backgroundImage: glow, opacity: hovering ? 1 : 0 }}
        />
        {children}
      </motion.div>
    </div>
  )
}
