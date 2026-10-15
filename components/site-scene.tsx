'use client'

import Link from 'next/link'
import type { ReactElement } from 'react'
import { markModuleSeen } from './module-badges'

/**
 * 一幅画：小屋、院子、聚会、还有那个拿信的人，都在同一幅场景里
 *
 * 为什么做成"一幅画"而不是四张小图：
 *   四张小图是四个图标；一幅画是一个地方。前者告诉你"能干什么"，
 *   后者让你觉得"这是哪儿" —— 后者才是这个站想要的感觉。
 *
 * 画的是什么（一条地平线，从左到右）：
 *   篱笆 → 小路与信箱 → 亮着灯的小屋（烟囱冒烟）→ 树与长凳 →
 *   一个攥着信的人 → 吊着灯笼的长桌（两只杯子、两只凳子）→ 远处两只鸟
 *
 * 四个地方在画里各是一块**可点区域**（透明热区 + 一行名字标签）。
 * 热区用百分比定位，所以整幅画在手机上等比缩小后，位置依然对得上。
 * 标签是 HTML 文字（不是画进 SVG 的），这样既好读、也能带未读数。
 */

const HONEY = '#d99a4e'
const WAX = '#a8563a'
const CREAM = '#fdf8f0'
const LINE = '#e0d3bd'

type Hotspot = {
  key: string
  href: string
  label: string
  /** 热区：百分比（相对整幅画） */
  hit: { left: string; top: string; width: string; height: string }
  /** 标签位置 */
  tag: { left: string; top: string }
}

const HOTSPOTS: Hotspot[] = [
  {
    key: 'friends',
    href: '/friends',
    label: '小屋',
    hit: { left: '12%', top: '26%', width: '24%', height: '58%' },
    tag: { left: '17%', top: '87%' },
  },
  {
    key: 'world',
    href: '/world',
    label: '院子',
    hit: { left: '31%', top: '28%', width: '17%', height: '56%' },
    tag: { left: '34%', top: '87%' },
  },
  {
    key: 'me',
    href: '/me',
    label: '我的',
    hit: { left: '46%', top: '34%', width: '14%', height: '50%' },
    tag: { left: '48%', top: '87%' },
  },
  {
    key: 'play',
    href: '/play',
    label: '聚会',
    hit: { left: '57%', top: '18%', width: '22%', height: '66%' },
    tag: { left: '62%', top: '87%' },
  },
]

export function SiteScene({
  badges,
}: {
  badges?: Partial<Record<string, { count?: number; dot?: boolean }>>
}): ReactElement {
  return (
    <div className="relative w-full">
      <svg
        viewBox="0 0 960 320"
        className="h-auto w-full text-[#3a2f26]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        role="img"
        aria-label="一幅画：左边是亮着灯的小屋，旁边有树和长凳，中间有人拿着一封信，右边是挂着灯笼的长桌"
      >
        {/* 地平线 */}
        <path d="M24 268h912" />

        {/* 远处的太阳与两只鸟 */}
        <circle cx="120" cy="52" r="16" fill={HONEY} stroke="none" opacity="0.5" />
        <path d="M770 62q5-5 10 0M788 74q4-4 8 0" stroke={LINE} />

        {/* 篱笆 */}
        <path d="M40 236v-26M62 236v-32M84 236v-26M106 236v-32M128 236v-26M40 218h88M40 228h88" />

        {/* 小路（从门口通到篱笆外）*/}
        <path d="M196 268q-30-14-56-18M300 268q30-14 58-18" stroke={LINE} />

        {/* 信箱：立在小路旁 */}
        <path d="M150 268v-30" />
        <rect x="132" y="214" width="36" height="24" rx="3" fill={CREAM} />
        <path d="M132 214h36v24h-36z" />
        <path d="M168 222v-8h6v8" stroke={WAX} />

        {/* 小屋 */}
        <rect x="170" y="168" width="140" height="100" fill={CREAM} />
        <path d="M170 168h140v100H170z" />
        <path d="M154 170 240 108l86 62" />
        <path d="M272 132v-16h14v26" />
        <path d="M292 104q6-5 0-11t2-12" stroke={LINE} />
        {/* 门（火漆红）*/}
        <rect x="222" y="212" width="34" height="56" fill={WAX} stroke="none" />
        <path d="M222 212h34v56h-34z" />
        <circle cx="248" cy="240" r="2" fill={CREAM} stroke="none" />
        {/* 亮着灯的窗（蜜色）*/}
        <rect x="268" y="186" width="32" height="26" fill={HONEY} stroke="none" />
        <path d="M268 186h32v26h-32zM284 186v26" />

        {/* 树 */}
        <path d="M440 268v-46" />
        <circle cx="440" cy="176" r="44" fill={CREAM} />
        <path d="M424 166q8-8 16 0M430 186q8-6 18 2" />

        {/* 长凳 */}
        <path d="M366 246h58M374 246v22M416 246v22" stroke={LINE} />

        {/* 拿信的人 */}
        <circle cx="516" cy="170" r="15" fill={CREAM} />
        <path d="M490 268v-52c0-15 12-24 26-24s26 9 26 24v52" fill={CREAM} />
        <path d="M490 268v-52c0-15 12-24 26-24s26 9 26 24v52" />
        {/* 伸出的手 */}
        <path d="M542 224l16 8" />
        {/* 手里的信 */}
        <rect x="558" y="224" width="42" height="28" fill={CREAM} />
        <path d="M558 224l21 15 21-15" />
        {/* 封口的火漆：整幅画第二个红点 */}
        <circle cx="579" cy="245" r="3.4" fill={WAX} stroke="none" />

        {/* 吊着的灯笼（蜜色 = 亮着） */}
        <path d="M700 44v22" stroke={LINE} />
        <rect x="686" y="66" width="28" height="34" rx="4" fill={HONEY} stroke="none" />
        <rect x="686" y="66" width="28" height="34" rx="4" />

        {/* 长桌 */}
        <ellipse cx="700" cy="238" rx="74" ry="14" fill={CREAM} />
        <path d="M646 238v30M754 238v30M676 268h48" />
        {/* 两只杯子 */}
        <path d="M676 226v-12h14v12M710 226v-12h14v12" />
        {/* 两只凳子 */}
        <path d="M592 268v-14h26v14M782 268v-14h-26v14" stroke={LINE} />
      </svg>

      {/* 四个可点区域：热区透明，标签是文字 */}
      {HOTSPOTS.map((spot) => {
        const badge = badges?.[spot.key]
        return (
          <Link
            key={spot.key}
            href={spot.href}
            onClick={() => markModuleSeen(spot.key as Parameters<typeof markModuleSeen>[0])}
            aria-label={spot.label}
            className="group absolute rounded-xl transition hover:bg-[rgba(168,86,58,0.06)]"
            style={spot.hit}
          >
            <span
              className="absolute flex items-baseline gap-1.5 whitespace-nowrap font-serif-cn text-sm text-[#3a2f26] transition group-hover:text-[#a8563a]"
              style={spot.tag}
            >
              {spot.label}
              {badge?.count ? (
                <span className="text-[11px] tabular-nums text-[#a8563a]">
                  {badge.count > 99 ? '99+' : badge.count}
                </span>
              ) : badge?.dot ? (
                <span className="mb-1 h-1.5 w-1.5 rounded-full bg-[#a8563a]" />
              ) : null}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
