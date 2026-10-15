'use client'

import type { ReactElement } from 'react'

/**
 * 四个模块的手绘线条插画
 *
 * 为什么自己画而不是用图标库：
 *   · 图标库的图标是"功能符号"，画的是"这里能干什么"；
 *     这里要的是"这里是什么地方"——一间亮着灯的小屋、一个有树的院子、
 *     一张摆了杯子的桌子、一个攥着信的人。
 *   · 线条插画比几何色块更贴"来信"这个主题，也比图标更暖。
 *
 * 画法约定（四张保持同一套，才不会看起来像四个来源）：
 *   · viewBox 0 0 96 72，地平线统一在 y=64
 *   · 线宽一律 1.5、圆头圆角；线条走 currentColor（悬停时整张画会跟着变色）
 *   · 只填两处颜色：蜜色 #d99a4e 表示"亮着"（窗、灯笼），火漆红 #a8563a 点一个重点
 *   · 不用渐变、不用阴影、不画表情 —— 含蓄靠留白，不靠细节
 */

const HONEY = '#d99a4e'
const WAX = '#a8563a'
const CREAM = '#fdf8f0'

type Props = { className?: string }

function Frame({ className, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 96 72"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

/** 小屋：亮着灯的窗，烟囱冒一缕烟 */
export function ArtHouse({ className }: Props) {
  return (
    <Frame className={className}>
      <path d="M8 64h80" />
      <path d="M26 64V36h36v28" fill={CREAM} />
      <path d="M20 37 44 19l24 18" />
      <path d="M58 27v-7h5v10" />
      <path d="M40 64V51a4 4 0 0 1 8 0v13" fill={WAX} stroke="none" />
      <path d="M40 64V51a4 4 0 0 1 8 0v13" />
      <rect x="52" y="43" width="10" height="9" fill={HONEY} stroke="none" />
      <path d="M52 43h10v9h-10z" />
      <path d="M63 14c3-2 0-4-1-6" />
    </Frame>
  )
}

/** 院子：一截矮墙、一棵树、一张长凳 */
export function ArtYard({ className }: Props) {
  return (
    <Frame className={className}>
      <path d="M8 64h80" />
      {/* 矮墙 */}
      <path d="M10 54h34M14 54V47M22 54V47M30 54V47M38 54V47M10 47h34" />
      {/* 树 */}
      <path d="M64 64V42" />
      <circle cx="64" cy="30" r="14" fill={CREAM} />
      <path d="M57 26q4-4 8 0M60 34q4-3 8 1" />
      {/* 长凳 */}
      <path d="M12 60h16M14 60v4M26 60v4" />
      {/* 一片落叶 */}
      <path d="M78 60q3-2 5 1" stroke={HONEY} />
    </Frame>
  )
}

/** 聚会：一张桌子、两只杯子、一盏灯笼 */
export function ArtGather({ className }: Props) {
  return (
    <Frame className={className}>
      <path d="M8 64h80" />
      {/* 灯笼 */}
      <path d="M48 8v6" />
      <rect x="43" y="14" width="10" height="12" rx="2" fill={HONEY} stroke="none" />
      <rect x="43" y="14" width="10" height="12" rx="2" />
      {/* 桌子 */}
      <ellipse cx="48" cy="46" rx="22" ry="5" fill={CREAM} />
      <path d="M32 46v16M64 46v16M40 62h16" />
      {/* 两只杯子 */}
      <path d="M40 42v-5h6v5M60 42v-5h-6v5" />
      {/* 两只凳子 */}
      <path d="M24 64v-6h10v6M72 64v-6H62v6" />
    </Frame>
  )
}

/** 我的：一个人，手里攥着一封信 */
export function ArtPerson({ className }: Props) {
  return (
    <Frame className={className}>
      <path d="M8 64h80" />
      <circle cx="46" cy="24" r="8" fill={CREAM} />
      <path d="M30 64V54c0-9 7-14 16-14s16 5 16 14v10" fill={CREAM} />
      {/* 伸出的手 */}
      <path d="M60 50l8 3" />
      {/* 手里的信 */}
      <rect x="68" y="46" width="16" height="11" fill={CREAM} />
      <path d="M68 46l8 6 8-6" />
      {/* 火漆印：全图唯一的一点红 */}
      <circle cx="76" cy="54" r="2" fill={WAX} stroke="none" />
    </Frame>
  )
}

export function ModuleArt({ kind, className }: { kind: string } & Props): ReactElement {
  switch (kind) {
    case 'friends':
      return <ArtHouse className={className} />
    case 'world':
      return <ArtYard className={className} />
    case 'play':
      return <ArtGather className={className} />
    default:
      return <ArtPerson className={className} />
  }
}
