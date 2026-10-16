'use client'

import type { RefObject } from 'react'

/**
 * 聊天气泡
 *
 * 两个聊天界面（小屋页内聊天、独立的 /friends/chat/[id]）共用这一份，
 * 免得两边各写一套、越改越不像。
 *
 * 相比原来的做法，做了四件事：
 *   1. 时间戳从气泡里挪到气泡下方的小字 —— 原来它在气泡内另起一行，
 *      一句「你好」也会被撑成一个方块
 *   2. 同一个人连着发的几条合成一组：组内间距收紧、只在组尾显示时间
 *   3. 按天插入分隔（今天 / 昨天 / 8月14日）
 *   4. 气泡收口：最后一条的靠人那一角收成小圆角，像气泡的尖
 *
 * 头像沿用站内既有的做法（首字 + 暖色圆底），和聊天抬头保持一致。
 */

export type ChatMessage = {
  id: string
  sender_id: string
  content: string
  created_at: string
}

/** 同一组的时间间隔上限：超过就当新的一组 */
const GROUP_GAP_MS = 5 * 60 * 1000

function clock(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfToday - t) / 86400000)
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days === 2) return '前天'
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日`
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

export function ChatMessages({
  messages,
  meId,
  friendName = '',
  bottomRef,
}: {
  messages: ChatMessage[]
  meId: string | null
  friendName?: string
  bottomRef?: RefObject<HTMLDivElement | null>
}) {
  const initial = friendName.trim()[0] ?? '友'

  return (
    <div>
      {messages.map((m, i) => {
        const prev = messages[i - 1]
        const next = messages[i + 1]
        const mine = m.sender_id === meId

        const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at)
        const firstOfGroup =
          newDay ||
          !prev ||
          prev.sender_id !== m.sender_id ||
          new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > GROUP_GAP_MS
        const lastOfGroup =
          !next ||
          next.sender_id !== m.sender_id ||
          new Date(next.created_at).getTime() - new Date(m.created_at).getTime() > GROUP_GAP_MS ||
          dayKey(next.created_at) !== dayKey(m.created_at)

        return (
          <div key={m.id}>
            {newDay && (
              <div className="flex justify-center py-3.5">
                <span className="rounded-full bg-primary/5 px-3 py-1 font-serif-cn text-[11px] text-base-content/60">
                  {dayLabel(m.created_at)}
                </span>
              </div>
            )}

            <div
              className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'} ${
                firstOfGroup ? 'mt-3' : 'mt-1'
              }`}
            >
              {/* 好友头像：只在组尾出现，和气泡底对齐 */}
              {!mine && (
                <span className="w-7 flex-shrink-0">
                  {lastOfGroup && (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent-light)] font-serif-cn text-[11px] font-semibold text-[var(--accent-deep)]">
                      {initial}
                    </span>
                  )}
                </span>
              )}

              <div className={`flex max-w-[72%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <div
                  className={`animate-fade-in px-4 py-2.5 text-[13.5px] leading-relaxed ${
                    mine
                      ? 'bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent)] text-white shadow-sm'
                      : 'border border-base-300 bg-base-100 text-base-content shadow-sm'
                  } rounded-[20px] ${lastOfGroup ? (mine ? 'rounded-br-[7px]' : 'rounded-bl-[7px]') : ''}`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                </div>

                {/* 时间挪到气泡外面：气泡就能保持紧凑 */}
                {lastOfGroup && (
                  <span className="mt-1 px-1 font-serif-cn text-[11px] text-base-content/60">
                    {clock(m.created_at)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
