'use client'

import Link from 'next/link'
import type { ReactElement } from 'react'
import { markModuleSeen } from './module-badges'

/**
 * 一幅画：小屋、院子、聚会、还有那个拿信的人，都在同一幅场景里
 *
 * 这不是"四个图标"，而是一个地方。上一版画得太简洁抽象（几何图元拼的），
 * 这一版按"有美感的线条插画"重画，加了这样几层东西：
 *
 *   层次    远山 → 背景小树 → 篱笆与小路 → 小屋 → 大树与长凳 → 人与长桌 → 前景草丛
 *   质感    屋顶瓦楞（一排小弧）、树冠是几组交叠的弧而不是一个圆、
 *           墙面的短横线、屋檐与长凳下的排线阴影
 *   遮挡    屋檐压住墙、树冠压住树干、桌布压住桌腿、人压住小路
 *   淡彩    只上四色：屋顶灰棕、树冠暖卡其、蜜色（窗与灯笼）、火漆红（门与封漆）
 *   细节    门口一盆花、窗里的帘、凳子上的猫、杯子冒的热气、灯笼的穗、飘落的叶
 *
 * 四个地方在画里各是一块可点区域（透明热区 + 一行 HTML 名字标签）。
 * 热区用百分比定位，所以整幅画在手机上等比缩小后位置依然对得上。
 */

const HONEY = '#d99a4e'
const WAX = '#a8563a'
const CREAM = '#fdf8f0'
const ROOF = '#d8c3a3'
const CANOPY = '#cdbf9a'
const GRASS = '#c3b393'
const LINE = '#e0d3bd'

type Hotspot = {
  key: string
  href: string
  label: string
  hit: { left: string; top: string; width: string; height: string }
  tag: { left: string; top: string }
}

const HOTSPOTS: Hotspot[] = [
  {
    key: 'friends',
    href: '/friends',
    label: '小屋',
    hit: { left: '11%', top: '22%', width: '25%', height: '62%' },
    tag: { left: '16%', top: '90%' },
  },
  {
    key: 'world',
    href: '/world',
    label: '院子',
    hit: { left: '31%', top: '24%', width: '18%', height: '60%' },
    tag: { left: '35%', top: '90%' },
  },
  {
    key: 'me',
    href: '/me',
    label: '我的',
    hit: { left: '47%', top: '30%', width: '13%', height: '54%' },
    tag: { left: '48%', top: '90%' },
  },
  {
    key: 'play',
    href: '/play',
    label: '聚会',
    hit: { left: '57%', top: '14%', width: '24%', height: '70%' },
    tag: { left: '63%', top: '90%' },
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
        viewBox="0 0 960 340"
        className="h-auto w-full text-[#3f332a]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        role="img"
        aria-label="一幅画：傍晚，左边是亮着灯的小屋，屋旁有信箱与篱笆；中间一棵大树和一张长凳，一个人拿着一封信走过来；右边一张长桌挂着灯笼，摆着两只冒热气的杯子"
      >
        {/* ── 远山 ── */}
        <path d="M40 214q90-42 190-6t180-10 170 6 160-14 140 12" stroke={LINE} />
        {/* 背景小树（细线，退远） */}
        <path d="M812 214v-22M812 192l-10-12M812 192l10-12M812 202l-9-9M812 202l9-9" stroke={LINE} />
        <path d="M866 214v-16M866 198l-8-10M866 198l8-10" stroke={LINE} />

        {/* ── 云与太阳 ── */}
        <path d="M120 64q10-12 26-8t22 12q14-2 16 10H108q0-10 12-14z" stroke={LINE} />
        <circle cx="212" cy="52" r="18" fill={HONEY} stroke="none" opacity="0.45" />
        <path d="M212 22v-8M238 34l6-6M186 34l-6-6" stroke={LINE} />

        {/* 远处两只鸟 */}
        <path d="M700 74q6-6 12 0M722 88q5-5 10 0" stroke={LINE} />

        {/* ── 地平线 ── */}
        <path d="M24 288h912" />

        {/* ── 篱笆（藤蔓缠在第二根柱子上）── */}
        <path d="M40 252h96M40 266h96" stroke={LINE} />
        <path d="M44 272v-34M64 272v-40M84 272v-34M104 272v-40M124 272v-34" />
        <path d="M104 240q-8 6-4 14t-2 12" stroke={LINE} />

        {/* ── 小路：不规则边 + 几块踏石 ── */}
        <path d="M204 288q-26-16-46-20M304 288q26-16 48-20" stroke={LINE} />
        <path d="M132 276q6-4 14 0M112 262q6-4 14 0" stroke={GRASS} />

        {/* ── 信箱 ── */}
        <path d="M150 288v-34" />
        <rect x="128" y="228" width="44" height="26" rx="4" fill={CREAM} />
        <path d="M128 228h44v26h-44z" />
        <path d="M138 228v-8l10 6 10-6v8" stroke={LINE} />
        <path d="M172 236v-10h7v10" stroke={WAX} />

        {/* ── 小屋 ── */}
        {/* 墙 */}
        <rect x="176" y="176" width="152" height="112" fill={CREAM} />
        <path d="M176 176h152v112H176z" />
        {/* 墙面短横线（质感） */}
        <path d="M188 196h18M188 208h12M188 244h16M188 256h10" stroke={LINE} />
        {/* 屋顶：两层 + 一排瓦楞 + 屋脊 */}
        <path d="M156 178 252 108l96 70" fill={ROOF} />
        <path d="M156 178 252 108l96 70z" />
        <path d="M170 168h164" stroke={LINE} />
        <path d="M186 155q6 6 12 0M214 136q6 6 12 0M242 118q6 6 12 0M270 132q6 6 12 0M298 152q6 6 12 0" stroke={LINE} />
        {/* 烟囱与两缕烟 */}
        <path d="M282 138v-18h16v26" fill={CREAM} />
        <path d="M282 138v-18h16v26z" />
        <path d="M304 108q8-6 0-13t4-13M316 116q6-5 0-10" stroke={LINE} />
        {/* 门（火漆红）+ 台阶 + 门口一盆花 */}
        <rect x="224" y="222" width="36" height="66" fill={WAX} stroke="none" />
        <path d="M224 222h36v66h-36z" />
        <circle cx="252" cy="254" r="2" fill={CREAM} stroke="none" />
        <path d="M216 288h52" stroke={LINE} />
        <path d="M298 288v-14M292 274h12l-6-8z" fill={HONEY} />
        {/* 窗（蜜色 = 亮着）：窗框 + 十字 + 帘子 */}
        <rect x="272" y="196" width="40" height="30" fill={HONEY} stroke="none" />
        <path d="M272 196h40v30h-40zM292 196v30M272 211h40" />
        <path d="M272 196q8 10 0 20M312 196q-8 10 0 20" stroke={LINE} />
        {/* 屋檐下的排线阴影 */}
        <path d="M182 182h140M186 188h132" stroke={LINE} />

        {/* ── 大树：树干分叉 + 交叠的树冠（不是一个大圆）── */}
        <path d="M452 288V228" />
        <path d="M452 244l-18-16M452 236l16-14" />
        <path d="M414 214q-16-16 0-30t30-12q-6-20 16-24t30 10q16-8 26 6t0 26q10 14-6 22t-30-2q-14 12-30 4t-6-20z" fill={CANOPY} />
        <path d="M414 214q-16-16 0-30t30-12q-6-20 16-24t30 10q16-8 26 6t0 26q10 14-6 22t-30-2q-14 12-30 4t-6-20z" />
        <path d="M436 176q8-6 16 0M462 162q8-5 15 1M478 190q8-4 14 2" stroke={LINE} />
        {/* 飘落的叶 */}
        <path d="M398 232q4-4 9 0M388 252q4-4 9 0M500 236q4-4 9 0" stroke={HONEY} />

        {/* ── 长凳（带板条与凳下阴影）+ 一只猫 ── */}
        <path d="M364 258h66" />
        <path d="M368 250h58" stroke={LINE} />
        <path d="M376 258v26M418 258v26" />
        <path d="M378 264h38M378 272h38" stroke={LINE} />
        <path d="M402 250q4-10 12-10 8 0 10 8M424 240l4-6M404 244l-3-6" stroke={WAX} />

        {/* ── 拿信的人：头发、围巾、衣褶、手里的信 ── */}
        <path d="M512 172q-16 0-16-16t16-16 16 16-16 16z" fill={CREAM} />
        <path d="M512 172q-16 0-16-16t16-16 16 16-16 16z" />
        <path d="M498 146q6-12 20-10t10 12" stroke={LINE} />
        <path d="M486 288v-58q0-16 14-20t24 0q14 4 14 20v58" fill={CREAM} />
        <path d="M486 288v-58q0-16 14-20t24 0q14 4 14 20v58" />
        <path d="M500 214q12 6 24 0M508 232v20M522 232v18" stroke={LINE} />
        <path d="M494 174q18 8 36 0" stroke={LINE} />
        {/* 伸出的手臂 */}
        <path d="M538 224q10 6 18 8" />
        {/* 手里的信 */}
        <rect x="556" y="226" width="46" height="30" fill={CREAM} />
        <path d="M556 226l23 16 23-16" />
        <path d="M556 256h46" stroke={LINE} />
        <circle cx="579" cy="248" r="3.6" fill={WAX} stroke="none" />

        {/* ── 吊着的灯笼（蜜色）+ 穗子 ── */}
        <path d="M700 40v24" stroke={LINE} />
        <rect x="684" y="64" width="32" height="40" rx="5" fill={HONEY} stroke="none" />
        <rect x="684" y="64" width="32" height="40" rx="5" />
        <path d="M692 78h16M692 90h16M700 104v10M696 114h8" stroke={LINE} />

        {/* ── 长桌：桌布 + 两只杯（冒热气）+ 茶壶 + 两只凳子 ── */}
        <ellipse cx="700" cy="252" rx="82" ry="16" fill={CREAM} />
        <path d="M618 252q6 12 82 12t82-12" stroke={LINE} />
        <path d="M640 258v26M760 258v26M668 284h64" />
        <path d="M660 258h80" stroke={LINE} />
        {/* 杯子 + 热气 */}
        <path d="M672 240v-14h16v14M668 226h24" />
        <path d="M676 220q4-6 0-12M686 220q4-6 0-12" stroke={LINE} />
        <path d="M712 240v-14h16v14M708 226h24" />
        <path d="M716 220q4-6 0-12M726 220q4-6 0-12" stroke={LINE} />
        {/* 茶壶 */}
        <path d="M742 240q0-12 12-12t12 12q0 8-12 8t-12-8z" fill={CREAM} />
        <path d="M742 232l-8-4M766 232l8 2" stroke={LINE} />
        {/* 凳子 */}
        <path d="M584 288v-16h30v16M592 272v-8h14v8M788 288v-16h-30v16M796 272v-8h-14v8" stroke={LINE} />

        {/* ── 前景草丛 ── */}
        <path d="M60 288q4-12 8 0M74 288q4-10 8 0M88 288q4-12 8 0M330 288q4-12 8 0M344 288q4-10 8 0M840 288q4-12 8 0M854 288q4-10 8 0M868 288q4-12 8 0" stroke={GRASS} />
      </svg>

      {/* 四个可点区域 */}
      {HOTSPOTS.map((spot) => {
        const badge = badges?.[spot.key]
        return (
          <Link
            key={spot.key}
            href={spot.href}
            onClick={() => markModuleSeen(spot.key as Parameters<typeof markModuleSeen>[0])}
            aria-label={spot.label}
            className="group absolute rounded-xl transition hover:bg-[rgba(168,86,58,0.05)]"
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
