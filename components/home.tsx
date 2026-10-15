'use client'

import Link from 'next/link'
import type { ReactElement } from 'react'
import { IconArrow, IconFlame, IconMail, WeatherIcon } from './icons'
import { avatarFallback } from './utils'
import { markModuleSeen } from './module-badges'
import { ModuleArt } from './module-art'
import { weatherAdvice, type WeatherState } from './weather'
import type { FriendRequest, LoginStreak } from './types'

/* ==================== 侧边栏：天气 + 登录天数 + 每日一句 ==================== */

export function WeatherCard({ weather, dateText }: { weather: WeatherState; dateText: string }) {
  return (
    <div className="rounded-2xl border border-[var(--accent-line)] bg-gradient-to-br from-[var(--accent-soft)] via-[var(--accent-soft)] to-[var(--accent-line)] p-5 relative overflow-hidden shadow-sm">

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <WeatherIcon name={weather.icon} className="w-7 h-7 text-[var(--accent-light)]" />
          <span className="text-[11px] text-[var(--accent-muted)] tracking-wider">今日天气</span>
        </div>

        <p className="text-xs text-[var(--accent-muted)]">{dateText}</p>
        <p className="text-base text-[#5a4a3a] mt-1 font-medium">
          {weather.city} · {weather.condition}
        </p>

        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-2xl font-bold text-[var(--accent-deep)]">{weather.temp}°</span>
          <span className="text-xs text-[var(--accent-muted)]">/ {weather.tempMin}°</span>
        </div>

        <p className="text-[11px] text-[var(--accent-muted)] mt-3 leading-relaxed">{weatherAdvice(weather)}</p>
      </div>
    </div>
  )
}

export function LoginStreakCard({ streak }: { streak: LoginStreak }) {
  return (
    <div className="rounded-2xl border border-[var(--accent-line)] bg-white p-5 relative overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <IconFlame className="w-4 h-4 text-[var(--accent-light)]" />
        <span className="text-[11px] text-[var(--accent-muted)] tracking-wider">已经陪你走过</span>
      </div>

      <p className="text-[var(--accent-deep)]">
        <span className="text-3xl font-bold">{streak.days}</span>
        <span className="text-xs ml-1 text-[var(--accent-muted)]">天</span>
      </p>

      <p className="text-[11px] text-[var(--accent-muted)] mt-2">
        {streak.sinceLast <= 1 ? '今天是重逢的第一天' : `距上次见面 ${streak.sinceLast} 天`}
      </p>
    </div>
  )
}

export function DailyQuoteCard({ quote }: { quote: string }) {
  return (
    <div className="flex-1 rounded-2xl border border-[var(--accent-line)] bg-[var(--accent-soft)] p-5 relative overflow-hidden flex flex-col shadow-sm">
      <div className="absolute top-2 right-4 text-[var(--accent-line)] font-art text-6xl leading-none select-none pointer-events-none">
        &ldquo;
      </div>

      <div className="relative flex-1 flex flex-col justify-center">
        <p className="text-[11px] text-[var(--accent-muted)] mb-3 tracking-wider">今天的一句话</p>
        <p className="text-sm text-[#4a423c] leading-relaxed font-art italic">{quote || '……'}</p>
        <p className="text-[11px] text-[var(--accent-muted)] mt-3">— 来自陌生人的问候</p>
      </div>
    </div>
  )
}

/* ==================== 好友申请横幅（含默认头像占位） ==================== */

export function FriendRequestBanner({ requests }: { requests: FriendRequest[] }) {
  if (requests.length === 0) return null

  const preview = requests.slice(0, 3)

  return (
    <Link
      href="/friends"
      className="group flex items-center justify-between rounded-2xl border border-[var(--accent-line)] bg-gradient-to-r from-[var(--accent-soft)] to-[var(--accent-soft)] px-5 py-3 transition-all hover:shadow-sm hover:-translate-y-0.5 shadow-sm"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-white/70 backdrop-blur flex items-center justify-center">
            <IconMail className="w-4 h-4 text-[var(--accent-deep)]" />
          </div>
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[var(--accent)] rounded-full ring-2 ring-[var(--accent-soft)]"></span>
        </div>

        <div className="min-w-0">
          <p className="text-sm font-medium text-[#2b2620]">有 {requests.length} 个新招呼</p>

          {/* 头像优先，没有头像就显示名字首字占位 */}
          <div className="flex items-center gap-1.5 mt-1">
            {preview.map((r) => (
              <span
                key={r.friendship_id}
                className="w-5 h-5 rounded-full overflow-hidden bg-[var(--accent-line)] flex items-center justify-center text-[11px] text-[var(--accent-deep)] flex-shrink-0"
                title={r.nickname || r.username}
              >
                {r.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  avatarFallback({ username: r.username, nickname: r.nickname, avatar_url: r.avatar_url })
                )}
              </span>
            ))}
            <span className="text-[11px] text-[var(--accent-muted)] ml-0.5">
              {requests.length > preview.length ? `等 ${requests.length} 人` : '点开看看是谁'}
            </span>
          </div>
        </div>
      </div>

      <IconArrow className="w-4 h-4 text-[var(--accent-muted)] group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
    </Link>
  )
}

/* ==================== 功能导航卡片网格 ==================== */

const BLOCKS = [
  { href: '/friends', title: '小屋', desc: '好友与私聊，慢慢说', span: true },
  { href: '/world', title: '院子', desc: '大家在想什么', span: false },
  { href: '/play', title: '聚会', desc: '活动、小工具、一起听歌', span: false },
  { href: '/me', title: '我的', desc: '资料、收藏、设置', span: false },
]


export function NavCardGrid({ badges }: { badges?: Partial<Record<string, { count?: number; dot?: boolean }>> }): ReactElement {
  /*
   * 每块左边是手绘插画（小屋/院子/聚会/小人），右边是名字与说明。
   * 插画走 currentColor，所以悬停时整张画的线条一起转成火漆红 ——
   * 一点含蓄的反馈，不用整块变色。
   */
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
      {BLOCKS.map((block) => {
        const key = block.href.replace('/', '')
        const badge = badges?.[key]
        return (
          <Link
            key={block.href}
            href={block.href}
            onClick={() => markModuleSeen(key as Parameters<typeof markModuleSeen>[0])}
            className="group flex items-center gap-5 rounded-lg border border-[#e0d3bd] bg-white/60 px-5 py-5 text-[#3a2f26] transition hover:border-[#a8563a] hover:bg-white hover:text-[#a8563a]"
          >
            <ModuleArt kind={key} className="h-16 w-[86px] flex-shrink-0 sm:h-[72px] sm:w-[96px]" />

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="font-serif-cn text-xl text-[#3a2f26]">{block.title}</span>
                {badge?.count ? (
                  <span className="text-[11px] tabular-nums text-[#a8563a]">
                    {badge.count > 99 ? '99+' : badge.count}
                  </span>
                ) : badge?.dot ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#a8563a]" />
                ) : null}
              </div>
              <p className="mt-1.5 truncate text-xs text-[#8a7a68]">{block.desc}</p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
