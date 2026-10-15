'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useFriendList } from './visibility'

/**
 * @ 功能
 *
 * 输入框里打 `@` 会弹出好友候选，选中后插入 `@昵称 `；
 * 正文里已有的 `@昵称` 在展示时会高亮。
 *
 * 不做站内通知（那需要额外的通知表）——被 @ 的人靠昵称能认出来，
 * 也可以在搜索里找到相关评论。
 */

/* ==================== 展示：把 @昵称 高亮 ==================== */

/** 匹配 @ 加一串非空白字符（昵称里可能有空格，所以只吃到空白为止） */
const MENTION_RE = /@([^\s@]{1,20})/g

export function renderMentions(text: string, names: string[]): ReactNode {
  if (!text) return null

  // 只高亮"确实存在的好友昵称"，避免把邮箱之类的 @ 也染色
  const known = new Set(names.map((n) => n.trim()).filter(Boolean))
  if (known.size === 0) return text

  const nodes: ReactNode[] = []
  let lastIndex = 0
  let key = 0

  for (const match of text.matchAll(MENTION_RE)) {
    const name = match[1]
    const start = match.index ?? 0
    if (!known.has(name)) continue

    if (start > lastIndex) nodes.push(text.slice(lastIndex, start))
    nodes.push(
      <span key={`m-${key++}`} className="font-medium text-[#5a8a4a]">
        @{name}
      </span>,
    )
    lastIndex = start + match[0].length
  }

  if (lastIndex === 0) return text
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

/* ==================== 输入：@ 触发候选 ==================== */

export type MentionInputProps = {
  value: string
  onChange: (next: string) => void
  onEnter?: () => void
  placeholder?: string
  maxLength?: number
  className?: string
  meId: string | null
  autoFocus?: boolean
}

export function MentionInput({
  value,
  onChange,
  onEnter,
  placeholder,
  maxLength,
  className = '',
  meId,
  autoFocus,
}: MentionInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [atIndex, setAtIndex] = useState<number | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const { friends } = useFriendList(meId)

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? friends.filter((f) => f.name.toLowerCase().includes(q))
      : friends
    return list.slice(0, 6)
  }, [friends, query])

  // 输入变化后判断是否处于 "@xxx" 状态
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    const caret = el.selectionStart ?? value.length
    const before = value.slice(0, caret)
    const at = before.lastIndexOf('@')

    if (at < 0) {
      setOpen(false)
      setAtIndex(null)
      return
    }

    // @ 前面必须是开头或空白，否则当成邮箱之类的普通字符
    const prevChar = at > 0 ? before[at - 1] : ''
    if (prevChar && !/\s/.test(prevChar)) {
      setOpen(false)
      setAtIndex(null)
      return
    }

    const fragment = before.slice(at + 1)
    // 片段里出现空白说明这个 @ 已经输入完了
    if (/\s/.test(fragment)) {
      setOpen(false)
      setAtIndex(null)
      return
    }

    setQuery(fragment)
    setAtIndex(at)
    setActiveIndex(0)
    setOpen(true)
  }, [value])

  function insertMention(name: string) {
    if (atIndex === null) return
    const el = inputRef.current
    const caret = el?.selectionStart ?? value.length
    const next = `${value.slice(0, atIndex)}@${name} ${value.slice(caret)}`
    onChange(next)
    setOpen(false)
    setAtIndex(null)

    const nextCaret = atIndex + name.length + 2
    window.requestAnimationFrame(() => {
      const node = inputRef.current
      if (!node) return
      node.focus()
      node.setSelectionRange(nextCaret, nextCaret)
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (open && candidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % candidates.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + candidates.length) % candidates.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(candidates[activeIndex].name)
        return
      }
      if (e.key === 'Escape') {
        setOpen(false)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && onEnter) {
      e.preventDefault()
      onEnter()
    }
  }

  return (
    <div className="relative flex-1 min-w-0">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        className={className}
      />

      {open && candidates.length > 0 && (
        <div className="absolute bottom-full left-0 z-30 mb-1 w-56 overflow-hidden rounded-xl border border-[#d8e8c8] bg-white shadow-lg">
          <p className="border-b border-[#f0f7e8] px-3 py-1.5 text-[10px] text-[#9aa88a]">
            选一个人 @ 一下
          </p>
          {candidates.map((f, i) => (
            <button
              key={f.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                insertMention(f.name)
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition ${
                i === activeIndex ? 'bg-[#f0f7e8] text-[#3a4a2a]' : 'text-[#5a6a4a] hover:bg-[#f7fbf2]'
              }`}
            >
              <span className="h-5 w-5 flex-shrink-0 overflow-hidden rounded-full bg-[#e0e8d8] flex items-center justify-center text-[9px] text-[#5a8a4a]">
                {f.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  f.name.slice(0, 1)
                )}
              </span>
              <span className="truncate">{f.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
