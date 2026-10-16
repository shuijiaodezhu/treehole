'use client'

import type { RefObject } from 'react'

/**
 * 聊天气泡 —— 用 daisyUI 的 chat 组件
 *
 * 结构：chat + chat-start/chat-end，里面是 chat-image / chat-header /
 * chat-bubble / chat-footer。自己的气泡用 chat-bubble-primary（主题的蜡封红），
 * 对方的是 chat-bubble 默认色（主题的 base 系）。颜色一律不写死。
 *
 * 分组规则照旧（这部分和样式无关，只是"什么时候算一组"）：
 *   1. 时间戳放 chat-footer，不塞在气泡里 —— 一句「你好」不会被撑成方块
 *   2. 同一个人连着发的几条算一组：组内间距紧、只在组尾显示时间与头像
 *   3. 按天插入分隔（今天 / 昨天 / 前天 / 8月14日）
 *   4. 头像只在组尾出现，和气泡底对齐
 *
 * 两个聊天界面（小屋页内聊天、/friends/chat/[id]）共用这一份。
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
                <span className="badge badge-ghost badge-sm font-serif-cn">
                  {dayLabel(m.created_at)}
                </span>
              </div>
            )}

            <div
              className={`chat ${mine ? 'chat-end' : 'chat-start'} ${
                firstOfGroup ? 'mt-3' : 'mt-0.5'
              }`}
            >
              {/*
                头像：只在组尾出现。
                ⚠️ 必须 self-start ✗ 否则会"歪"：
                  daisyUI 的 chat-image 默认是 grid-row: span 2
                  → 它跨了"气泡 + 下面的时间"两行 ✓
                  → 头像的垂直中心落在两者之间 → 看着就是往下歪了 ✓
                  self-start 让它贴住气泡顶端（和微信一致 ✓）
                  （更喜欢贴气泡**底**的话，把 self-start 换成 self-end ✓）
              */}
              {!mine && (
                <div className="chat-image avatar placeholder self-start">
                  {/* 圆圈必须写死正方形（h-7 w-7）：daisyUI 的 chat-image 默认跨两行
                      （气泡 + 时间），只写 w-7 时高度会继承那两行 → 圆被拉成椭圆
                      → 里头的字母看着就是"歪"的。再自己 flex 居中 + 字加 leading-none */}
                  {lastOfGroup && (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/25 text-base-content">
                      <span className="font-serif-cn text-[11px] font-semibold leading-none">
                        {initial}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div
                className={`chat-bubble animate-fade-in text-[13.5px] leading-relaxed ${
                  mine ? 'chat-bubble-primary' : ''
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
              </div>

              {/* 时间放 chat-footer：气泡就能保持紧凑 */}
              {lastOfGroup && (
                <div className="chat-footer font-serif-cn text-[11px] opacity-60">
                  {clock(m.created_at)}
                </div>
              )}
            </div>
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
