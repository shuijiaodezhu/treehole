'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

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

/** 自绘的可爱笑脸（用 currentColor，跟着页面主色走，不依赖系统 emoji 字体） */
function CuteFace({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* 脸 */}
      <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="1.4" />
      {/* 笑眼：细月牙（实心），比描边弧在小尺寸下更清楚 */}
      <path d="M8.4 10.5A1.2 1.05 0 0 1 10.8 10.5A1.2 0.35 0 0 0 8.4 10.5Z" fill="currentColor" />
      <path d="M13.2 10.5A1.2 1.05 0 0 1 15.6 10.5A1.2 0.35 0 0 0 13.2 10.5Z" fill="currentColor" />
      {/* 嘴 */}
      <path
        d="M9 14.2A3 1.35 0 0 0 15 14.2"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
      {/* 腮红 */}
      <circle cx="6.9" cy="13" r="0.85" fill="currentColor" opacity="0.32" />
      <circle cx="17.1" cy="13" r="0.85" fill="currentColor" opacity="0.32" />
    </svg>
  )
}

/** 触发按钮尺寸：sm 用于表单行，md 用于和圆形发送键并排 */
const TRIGGER = {
  sm: { box: 'h-8 w-8', icon: 'h-[18px] w-[18px]' },
  md: { box: 'h-11 w-11', icon: 'h-6 w-6' },
} as const

export function EmojiPicker({
  onPick,
  className = '',
  align = 'left',
  size = 'sm',
}: {
  /** 选中一个表情时回调（调用方负责插进输入框） */
  onPick: (emoji: string) => void
  className?: string
  /** 面板对齐方向：输入框在屏幕右侧时用 right，避免溢出 */
  align?: 'left' | 'right'
  /** sm = 表单行里的紧凑尺寸；md = 与 44px 圆形发送键并排 */
  size?: keyof typeof TRIGGER
}) {
  const [open, setOpen] = useState(false)
  const [group, setGroup] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const t = TRIGGER[size]

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
      {/*
        触发按钮：软圆底 + 淡描边，和输入框/发送键同一套语言
        展开时底色变实、图标轻轻放大一点，算个小小的「回应」
      */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="插入表情"
        title="插入表情"
        aria-expanded={open}
        className={`flex ${t.box} items-center justify-center rounded-full border transition-all duration-200 ${
          open
            ? 'border-primary bg-primary text-primary-content shadow-sm'
            : 'border-base-300 bg-primary/5 text-primary hover:-translate-y-0.5 hover:border-accent hover:shadow-sm'
        }`}
      >
        <CuteFace className={`${t.icon} transition-transform duration-200 ${open ? 'scale-110' : ''}`} />
      </button>

      {open && (
        <div
          className={`card absolute bottom-full z-40 mb-3 w-72 overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-sm ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {/* 小尖角，视觉上连回按钮 */}
          <span
            className={`absolute -bottom-1.5 h-3 w-3 rotate-45 border-b border-r border-base-300 bg-base-100 ${
              align === 'right' ? 'right-3' : 'left-3'
            }`}
          />

          <div className="flex gap-1 border-b border-base-300 bg-primary/5 px-2.5 py-2">
            {GROUPS.map((g, i) => (
              <button
                key={g.name}
                type="button"
                onClick={() => setGroup(i)}
                className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                  i === group
                    ? 'bg-base-100 font-medium text-primary shadow-sm'
                    : 'text-base-content/60 hover:bg-base-100/70'
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>

          <div className="grid max-h-48 grid-cols-8 gap-1 overflow-y-auto p-2.5">
            {GROUPS[group].emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onPick(emoji)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none transition duration-150 hover:scale-125 hover:bg-primary/5"
              >
                {emoji}
              </button>
            ))}
          </div>

          <p className="border-t border-base-300 px-3.5 py-2 text-[11px] text-base-content/60">
            点一下就插到光标处
          </p>
        </div>
      )}
    </div>
  )
}

/** 给聊天输入框用的小工具：把表情插到光标位置（拿不到光标就追加到末尾） */
function insertAtCursor(
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

/**
 * 给输入框用的便捷 hook：把表情插到光标处，并保持焦点
 *
 *   const emoji = useEmojiInsert(content, setContent)
 *   <textarea ref={emoji.ref} … />
 *   <EmojiPicker onPick={emoji.insert} />
 */
export function useEmojiInsert<T extends HTMLInputElement | HTMLTextAreaElement>(
  value: string,
  onChange: (next: string) => void,
) {
  const ref = useRef<T>(null)
  const insert = useCallback(
    (emoji: string) => {
      const el = ref.current
      const { next, caret } = insertAtCursor(el, value, emoji)
      onChange(next)
      // 等 React 更新完再把光标放回去
      window.requestAnimationFrame(() => {
        const node = ref.current
        if (!node) return
        node.focus()
        try {
          node.setSelectionRange(caret, caret)
        } catch {
          /* 某些 input 类型不支持 setSelectionRange，忽略 */
        }
      })
    },
    [value, onChange],
  )
  return { ref, insert }
}
