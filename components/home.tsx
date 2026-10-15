'use client'

import Link from 'next/link'
import type { ReactElement } from 'react'
import { IconArrow, IconBox, IconFlame, IconHome, IconLeaf, IconMail, IconSparkle, WeatherIcon } from './icons'
import { avatarFallback } from './utils'
import { weatherAdvice, type WeatherState } from './weather'
import type { FriendRequest, LoginStreak, NavSection } from './types'

/* ==================== 侧边栏：天气 + 登录天数 + 每日一句 ==================== */

export function WeatherCard({ weather, dateText }: { weather: WeatherState; dateText: string }) {
  return (
    <div className="rounded-2xl border border-[var(--accent-line)] bg-gradient-to-br from-[var(--accent-soft)] via-[var(--accent-soft)] to-[var(--accent-line)] p-5 relative overflow-hidden shadow-[0_2px_12px_rgba(217,119,87,0.04)]">
      <div className="absolute -top-6 -right-6 w-24 h-24 bg-[var(--accent-light)] opacity-20 rounded-full blur-2xl pointer-events-none"></div>

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <WeatherIcon name={weather.icon} className="w-7 h-7 text-[var(--accent-light)]" />
          <span className="text-[10px] text-[var(--accent-muted)] tracking-wider">今日天气</span>
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
    <div className="rounded-2xl border border-[var(--accent-line)] bg-white p-5 relative overflow-hidden shadow-[0_2px_12px_rgba(217,119,87,0.04)]">
      <div className="flex items-center gap-2 mb-3">
        <IconFlame className="w-4 h-4 text-[var(--accent-light)]" />
        <span className="text-[10px] text-[var(--accent-muted)] tracking-wider">已经陪你走过</span>
      </div>

      <p className="text-[var(--accent-deep)]">
        <span className="text-3xl font-bold">{streak.days}</span>
        <span className="text-xs ml-1 text-[var(--accent-muted)]">天</span>
      </p>

      <p className="text-[10px] text-[var(--accent-muted)] mt-2">
        {streak.sinceLast <= 1 ? '今天是重逢的第一天' : `距上次见面 ${streak.sinceLast} 天`}
      </p>
    </div>
  )
}

export function DailyQuoteCard({ quote }: { quote: string }) {
  return (
    <div className="flex-1 rounded-2xl border border-[var(--accent-line)] bg-gradient-to-br from-[var(--accent-soft)] to-[var(--accent-soft)] p-5 relative overflow-hidden flex flex-col shadow-[0_2px_12px_rgba(217,119,87,0.04)]">
      <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-[var(--accent)] opacity-[0.07] rounded-full blur-2xl pointer-events-none"></div>
      <div className="absolute top-2 right-4 text-[var(--accent-line)] font-art text-6xl leading-none select-none pointer-events-none">
        &ldquo;
      </div>

      <div className="relative flex-1 flex flex-col justify-center">
        <p className="text-[10px] text-[var(--accent-muted)] mb-3 tracking-wider">今天的一句话</p>
        <p className="text-sm text-[#4a423c] leading-relaxed font-art italic">{quote || '……'}</p>
        <p className="text-[10px] text-[var(--accent-muted)] mt-3">— 来自陌生人的问候</p>
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
      className="group flex items-center justify-between rounded-2xl border border-[var(--accent-line)] bg-gradient-to-r from-[var(--accent-soft)] to-[var(--accent-soft)] px-5 py-3 transition-all hover:shadow-[0_4px_16px_rgba(217,119,87,0.1)] hover:-translate-y-0.5 shadow-[0_2px_12px_rgba(217,119,87,0.04)]"
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
                className="w-5 h-5 rounded-full overflow-hidden bg-[var(--accent-line)] flex items-center justify-center text-[10px] text-[var(--accent-deep)] flex-shrink-0"
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
            <span className="text-[10px] text-[var(--accent-muted)] ml-0.5">
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

const SECTIONS: NavSection[] = [
  {
    href: '/friends',
    title: '小屋',
    desc: '好久没见啦',
    Icon: IconHome,
    gradient: 'from-[var(--accent-soft)] to-[var(--accent-line)]',
    accent: 'var(--accent)',
    tag: '私密',
  },
  {
    href: '/world',
    title: '院子',
    desc: '大家都在聊什么',
    Icon: IconLeaf,
    gradient: 'from-[#eef6e8] to-[#dceccf]',
    accent: '#7ea86a',
    tag: '公开',
  },
  {
    href: '/play',
    title: '聚会',
    desc: '又有什么新鲜玩意',
    Icon: IconSparkle,
    gradient: 'from-[var(--accent-soft)] to-[#f8dbe3]',
    accent: '#c97a8a',
    tag: '轻松',
  },
  {
    href: '/me',
    title: '我的',
    desc: '我把心跳藏在这里',
    Icon: IconBox,
    gradient: 'from-[#f0ecf7] to-[#e2d9ef]',
    accent: '#8a7aaa',
    tag: '私藏',
  },
]

export function NavCardGrid({ badges }: { badges?: Partial<Record<string, { count?: number; dot?: boolean }>> }): ReactElement {
  return (
    <div className="flex-1 grid grid-cols-2 gap-4">
      {SECTIONS.map((section) => {
        const badge = badges?.[section.href.replace('/', '')]
        return (
          <Link
            key={section.href}
            href={section.href}
            className={`group relative rounded-2xl border border-[var(--accent-line)] bg-gradient-to-br ${section.gradient} p-5 transition-all shadow-[0_2px_12px_rgba(217,119,87,0.04)] hover:shadow-[0_8px_24px_rgba(217,119,87,0.12)] hover:-translate-y-0.5 flex flex-col`}
          >
            {/* 未读提示：有精确数量就显示数字，否则只显示一个半明显的点（都在右上角） */}
            {badge?.count ? (
              <span className="absolute top-3.5 right-3.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--accent)] text-white text-[10px] leading-[18px] text-center font-medium ring-2 ring-white/70">
                {badge.count > 99 ? '99+' : badge.count}
              </span>
            ) : badge?.dot ? (
              <span className="absolute top-4 right-4 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-60 animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
              </span>
            ) : null}

            <div className="mb-4">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center bg-white/70 backdrop-blur"
              style={{ color: section.accent, boxShadow: `0 2px 8px ${section.accent}22` }}
            >
              <section.Icon className="w-5 h-5" />
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <h2 className="text-base font-semibold text-[#2b2620]">{section.title}</h2>
            <p className="text-xs text-[#6a6058] mt-1">{section.desc}</p>
          </div>

          <div className="flex items-center justify-between mt-4">
            <span
              className="text-[10px] px-2 py-0.5 rounded-full bg-white/60 backdrop-blur font-medium"
              style={{ color: section.accent }}
            >
              {section.tag}
            </span>
            <IconArrow className="w-4 h-4 text-[var(--accent-muted)] group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>
        )
      })}
    </div>
  )
}
