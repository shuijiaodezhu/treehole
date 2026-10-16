'use client'

import type { RefObject } from 'react'

/**
 * 聊天气泡 —— 用 daisyUI 的 chat 组件
 *
 * 结构：chat + chat-start/chat-end，里面是 chat-header / chat-bubble / chat-footer。
 * 不用头像（用户要求：有头像时那条会被往右挤 28px，左边缘参差不齐）。
 * 自己的气泡用 chat-bubble-primary（主题的蜡封红），
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
  bottomRef,
}: {
  messages: ChatMessage[]
  meId: string | null
  bottomRef?: RefObject<HTMLDivElement | null>
}) {
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
              {/* 不再显示头像（用户要求）：头像只在该组最后一条出现，
                  会让那一条比上面几条往右挤 28px → 左边缘参差不齐，看着"位置乱"
                  去掉后：对方全部靠左、自己全部靠右，边缘整齐 */}

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
