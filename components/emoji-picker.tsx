'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * 表情选择器（聊天 / 评论里用）
 *
 * 纯前端：点笑脸弹出面板，选中即把表情插入到输入框末尾。
 * 不做自定义表情包上传——那需要一张表 + Storage，属于另一件事。
 */

const GROUPS: { name: string; emojis: string[] }[] = [
  {
    name: '常用',
    emojis: ['😊', '😂', '🥰', '😍', '😘', '😌', '😴', '🤔', '😅', '😭', '😢', '😮', '🙃', '😉', '😎', '🤗'],
  },
  {
    name: '心情',
    emojis: ['❤️', '💛', '💚', '💙', '💜', '🖤', '💔', '✨', '🌙', '☀️', '🌈', '⭐', '🔥', '🎈', '🎉', '🎁'],
  },
  {
    name: '动作',
    emojis: ['👍', '👏', '🙏', '🤝', '💪', '✌️', '👋', '🤙', '🫶', '🙌', '👀', '🤧', '🥲', '🫠', '🤯', '😇'],
  },
  {
    name: '日常',
    emojis: ['🍚', '🍜', '🍰', '☕', '🍵', '🍺', '🍎', '🌻', '🌿', '🍃', '🐱', '🐶', '🐷', '🐟', '🌊', '⛰️'],
  },
  {
    name: '零散',
    emojis: ['💤', '💭', '📖', '🖊️', '📷', '🎵', '🎮', '⚽', '🚲', '🏠', '🌍', '⏰', '🧸', '🎀', '🪴', '🧋'],
  },
]

export function EmojiPicker({
  onPick,
  className = '',
  align = 'left',
}: {
  /** 选中一个表情时回调（调用方负责插进输入框） */
  onPick: (emoji: string) => void
  className?: string
  /** 面板对齐方向：输入框在屏幕右侧时用 right，避免溢出 */
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const [group, setGroup] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  // 点外面 / 按 Esc 关闭
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={boxRef} className={`relative flex-shrink-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="插入表情"
        title="插入表情"
        aria-expanded={open}
        className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
          open ? 'bg-[#fbeee4] text-[#c96447]' : 'text-[#a88868] hover:bg-[#fbeee4] hover:text-[#c96447]'
        }`}
      >
        <span className="text-base leading-none">😊</span>
      </button>

      {open && (
        <div
          className={`absolute bottom-full z-40 mb-2 w-64 overflow-hidden rounded-2xl border border-[#f0e4d4] bg-white shadow-xl ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="flex gap-1 border-b border-[#f7f0e8] px-2 py-1.5">
            {GROUPS.map((g, i) => (
              <button
                key={g.name}
                type="button"
                onClick={() => setGroup(i)}
                className={`rounded-lg px-2 py-1 text-[10px] transition ${
                  i === group ? 'bg-[#fbeee4] text-[#c96447] font-medium' : 'text-[#a88868] hover:bg-[#fdf7f2]'
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>

          <div className="grid max-h-44 grid-cols-8 gap-0.5 overflow-y-auto p-2">
            {GROUPS[group].emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onPick(emoji)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-base transition hover:bg-[#fdf3ec]"
              >
                {emoji}
              </button>
            ))}
          </div>

          <p className="border-t border-[#f7f0e8] px-3 py-1.5 text-[9px] text-[#c0b0a0]">
            点一下就插到输入框末尾
          </p>
        </div>
      )}
    </div>
  )
}

/** 给聊天输入框用的小工具：把表情插到光标位置（拿不到光标就追加到末尾） */
export function insertAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  value: string,
  text: string,
): { next: string; caret: number } {
  if (!el) return { next: value + text, caret: (value + text).length }
  const start = el.selectionStart ?? value.length
  const end = el.selectionEnd ?? value.length
  const next = value.slice(0, start) + text + value.slice(end)
  return { next, caret: start + text.length }
}

/** 一个不依赖 DOM 的简单版本：直接追加（评论框用这个就够） */
export function appendText(value: string, text: string): string {
  return value + text
}
