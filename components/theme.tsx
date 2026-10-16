'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createClient } from '../app/lib/supabase'

/**
 * 页面配色
 *
 * 每个页面一个「主色」，其余深浅色阶由 CSS 的 color-mix() 从主色派生
 * （见 globals.css 的 .page-theme）。用户只在设置里挑主色即可。
 *
 * 配色存在 profiles.theme 里（JSON 字符串，那一列本来就有），
 * 同时写一份到 localStorage，刷新时先本地生效、避免颜色闪一下。
 */

const supabase = createClient()

export type PageKey = 'home' | 'world' | 'play' | 'friends' | 'me'

export const PAGE_LABEL: Record<PageKey, string> = {
  home: '首页',
  world: '院子',
  play: '聚会',
  friends: '小屋',
  me: '我的',
}

export const PAGE_DESC: Record<PageKey, string> = {
  home: '进门那一屏',
  world: '发帖与聊天的地方',
  play: '活动和游戏',
  friends: '好友、朋友圈、储物箱、计划书',
  me: '个人资料与设置',
}

export const PAGE_ORDER: PageKey[] = ['home', 'world', 'play', 'friends', 'me']

/** 默认配色 = 各页面原本的颜色 */
const DEFAULT_THEME: Record<PageKey, string> = {
  home: '#d97757',
  world: '#7ea86a',
  play: '#5a7a9a',
  friends: '#d97757',
  me: '#a88ab8',
}

/** 预设色板（挑不到合意的话还可以用取色器自由选） */
export const PRESET_COLORS: string[] = [
  '#d97757', // 暖橘
  '#c9705a', // 陶土
  '#d9a441', // 麦黄
  '#c9a227', // 金
  '#7ea86a', // 抹茶
  '#4f8a6a', // 松绿
  '#4a9a9a', // 青碧
  '#5a7a9a', // 雾蓝
  '#5a6ab8', // 靛蓝
  '#8a6ac8', // 藤紫
  '#a88ab8', // 藕荷
  '#c46a92', // 海棠
  '#8a7a6a', // 咖褐
  '#6a6a72', // 石墨
]

const STORE_KEY = 'treehole:theme'

type ThemeMap = Record<PageKey, string>

function normalize(raw: unknown): ThemeMap {
  const result: ThemeMap = { ...DEFAULT_THEME }
  if (!raw || typeof raw !== 'object') return result
  for (const key of PAGE_ORDER) {
    const value = (raw as Record<string, unknown>)[key]
    if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)) result[key] = value.toLowerCase()
  }
  return result
}

/** 解析 profiles.theme 字段：兼容 'default' 这种旧值 */
function parseStoredTheme(stored: string | null | undefined): ThemeMap {
  if (!stored || stored === 'default') return { ...DEFAULT_THEME }
  try {
    return normalize(JSON.parse(stored))
  } catch {
    return { ...DEFAULT_THEME }
  }
}

/** 把配色写到 :root 上（CSS 变量） */
function applyTheme(theme: ThemeMap) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  for (const key of PAGE_ORDER) {
    const shades = deriveShades(theme[key])
    root.style.setProperty(`--page-${key}`, theme[key])
    root.style.setProperty(`--page-${key}-deep`, shades.deep)
    root.style.setProperty(`--page-${key}-ink`, shades.ink)
    root.style.setProperty(`--page-${key}-light`, shades.light)
    root.style.setProperty(`--page-${key}-muted`, shades.muted)
    root.style.setProperty(`--page-${key}-soft`, shades.soft)
    root.style.setProperty(`--page-${key}-line`, shades.line)
  }
}

/* ---------- 由主色算出色阶 ---------- */

const DARK_MIX = '#241c18'
const INK_MIX = '#201c18'
const GRAY_MIX = '#9a9a9a'

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

function rgbToHex(rgb: number[]): string {
  return (
    '#' +
    rgb
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
  )
}

/** ratio 是第一个颜色占的比例 */
function mix(hexA: string, ratioA: number, hexB: string): string {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  return rgbToHex(a.map((v, i) => v * ratioA + b[i] * (1 - ratioA)))
}

/**
 * 色阶公式（与 globals.css 里的默认值一致）：
 *   deep  更深，用于悬停与深色文字
 *   ink   最深，用于标题
 *   light 更浅，用于渐变另一端
 *   muted 次级文字
 *   soft  极淡底
 *   line  淡边框
 */
function deriveShades(accent: string): {
  deep: string
  ink: string
  light: string
  muted: string
  soft: string
  line: string
} {
  return {
    deep: mix(accent, 0.78, DARK_MIX),
    ink: mix(accent, 0.32, INK_MIX),
    light: mix(accent, 0.58, '#ffffff'),
    muted: mix(accent, 0.42, GRAY_MIX),
    soft: mix(accent, 0.07, '#ffffff'),
    line: mix(accent, 0.22, '#ffffff'),
  }
}

/** 页面根节点要挂的样式：把页面色阶映射成通用的 --accent-* */
export function pageAccentVars(page: PageKey): React.CSSProperties {
  return {
    /* 让 daisyUI 的 primary 跟着本页调色板走（这样按钮/卡片/角标都用本模块的颜色）*/
    '--color-primary': `var(--page-${page})`,
    '--color-primary-content': '#fdf8f0',
    '--accent': `var(--page-${page})`,
    '--accent-deep': `var(--page-${page}-deep)`,
    '--accent-ink': `var(--page-${page}-ink)`,
    '--accent-light': `var(--page-${page}-light)`,
    '--accent-muted': `var(--page-${page}-muted)`,
    '--accent-soft': `var(--page-${page}-soft)`,
    '--accent-line': `var(--page-${page}-line)`,
  } as React.CSSProperties
}

type ThemeContextValue = {
  theme: ThemeMap
  /** 改一个页面的主色（立即生效，不落库） */
  setPageColor: (page: PageKey, color: string) => void
  /** 全部恢复默认 */
  reset: () => void
  /** 存到服务器 */
  save: () => Promise<{ ok: boolean; message?: string }>
  /** 当前是否与服务器上保存的不一致 */
  dirty: boolean
  saving: boolean
  loading: boolean
  message: string
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeMap>(DEFAULT_THEME)
  const [saved, setSaved] = useState<ThemeMap | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  // 1) 先用本地缓存立即上色（避免刷新时闪一下默认色）
  useEffect(() => {
    try {
      const cached = window.localStorage.getItem(STORE_KEY)
      if (cached) {
        const parsed = normalize(JSON.parse(cached))
        // 读本地缓存后同步上色：这是「水合后立刻恢复配色」，必须同步，否则会闪
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTheme(parsed)
        applyTheme(parsed)
      } else {
        applyTheme(DEFAULT_THEME)
      }
    } catch {
      applyTheme(DEFAULT_THEME)
    }
  }, [])

  // 2) 再从服务器取，覆盖本地
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser()
        if (!userData.user) return
        const { data } = await supabase.from('profiles').select('theme').eq('id', userData.user.id).single()
        if (cancelled) return
        const parsed = parseStoredTheme(data?.theme ?? null)
        setTheme(parsed)
        setSaved(parsed)
        applyTheme(parsed)
        try {
          window.localStorage.setItem(STORE_KEY, JSON.stringify(parsed))
        } catch {
          /* 隐私模式下写不了，忽略 */
        }
      } catch (err) {
        console.error('读取配色失败:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const setPageColor = useCallback((page: PageKey, color: string) => {
    setMessage('')
    setTheme((prev) => {
      const next = { ...prev, [page]: color.toLowerCase() }
      applyTheme(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setMessage('')
    setTheme({ ...DEFAULT_THEME })
    applyTheme(DEFAULT_THEME)
  }, [])

  const save = useCallback(async () => {
    setSaving(true)
    setMessage('')
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return { ok: false, message: '请先登录' }

      const { data, error } = await supabase
        .from('profiles')
        .update({ theme: JSON.stringify(theme) })
        .eq('id', userData.user.id)
        .select('theme')
        .single()

      if (error) throw error
      if (!data) return { ok: false, message: '数据库没有更新任何一行' }

      setSaved(theme)
      try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify(theme))
      } catch {
        /* 忽略 */
      }
      setMessage('配色已保存')
      return { ok: true }
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err)
      setMessage('保存失败：' + msg)
      return { ok: false, message: msg }
    } finally {
      setSaving(false)
    }
  }, [theme])

  const dirty = useMemo(() => {
    if (!saved) return true
    return PAGE_ORDER.some((k) => saved[k] !== theme[k])
  }, [saved, theme])

  const value = useMemo(
    () => ({ theme, setPageColor, reset, save, dirty, saving, loading, message }),
    [theme, setPageColor, reset, save, dirty, saving, loading, message],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme 必须在 ThemeProvider 内使用')
  return ctx
}
