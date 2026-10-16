'use client'

/**
 * 主题（换的是"纸、卡、墨、线、强调色"，不换"每个地方自己的颜色"）
 *
 * 为什么值放在 TS 里、并且用**内联 style** 写上去 ✗ 不用样式表比优先级：
 *   浏览器里量过：<html data-theme="ink"> 已经设上 ✓ 但
 *   getComputedStyle 算出来的 --color-base-100 还是 #fdf9f2 ✗
 *   因为 daisyUI 有这么一条（优先级比我们的选择器高）：
 *     :root:has(input.theme-controller[value="treehole"]:checked) { --color-base-100: … }
 *   → 内联 style 必定赢过任何选择器 ✓ 所以写成内联 ✓
 *
 * ⚠️ "每个地方自己的颜色"不受影响：
 *   pageAccentVars 把 --color-primary 内联写在**页面那个 div** 上 ✓
 *   继承时离得近的祖先赢 ✓（这不是优先级，是覆盖）
 *   → 院子绿、我的紫照样在 ✓ 主题只管"纸" ✓
 */

export const THEME_KEY = 'treehole:theme'

export type ThemeId =
  | 'letter' | 'xuan' | 'stone' | 'ink' | 'moss' | 'dusk' | 'rain' | 'plain'

type Palette = {
  paper: string
  sheet: string
  card: string
  ink: string
  muted: string
  line: string
  wax: string
  waxSoft: string
  waxInk: string
  scheme: 'light' | 'dark'
}

export const PALETTES: Record<ThemeId, Palette> = {
  letter: {
    paper: '#f2e8d8', sheet: '#fdf9f2', card: '#f8eee2',
    ink: '#3a2f26', muted: '#8a7a68', line: '#e3d6bf',
    wax: '#a8563a', waxSoft: '#f4e5dc', waxInk: '#fdf8f0', scheme: 'light',
  },
  xuan: {
    paper: '#f4f1ea', sheet: '#fbfaf7', card: '#f7f4ef',
    ink: '#1f1c19', muted: '#7c756c', line: '#e6e1d8',
    wax: '#2f4a3c', waxSoft: '#e4ece7', waxInk: '#fdf8f0', scheme: 'light',
  },
  stone: {
    paper: '#e7eae6', sheet: '#f7f8f6', card: '#eef0ee',
    ink: '#24282a', muted: '#6d7573', line: '#d5dad6',
    wax: '#5c7a63', waxSoft: '#e2ebe5', waxInk: '#fdf8f0', scheme: 'light',
  },
  ink: {
    paper: '#1b1917', sheet: '#232120', card: '#2a2725',
    ink: '#efe8dd', muted: '#a79c8e', line: '#3a3634',
    wax: '#c98a5e', waxSoft: '#3a2f28', waxInk: '#fdf8f0', scheme: 'dark',
  },
  moss: {
    paper: '#e6e8dd', sheet: '#f6f7f0', card: '#eef0e6',
    ink: '#262a22', muted: '#6e7566', line: '#d6dac9',
    wax: '#8a6a3a', waxSoft: '#ece5d3', waxInk: '#fdf8f0', scheme: 'light',
  },
  dusk: {
    paper: '#efe4e2', sheet: '#fbf5f4', card: '#f5eae8',
    ink: '#2e2624', muted: '#7d6d6a', line: '#ded0cd',
    wax: '#8f4a44', waxSoft: '#f0e0dd', waxInk: '#fdf8f0', scheme: 'light',
  },
  rain: {
    paper: '#e5eaee', sheet: '#f6f8fa', card: '#edf1f4',
    ink: '#232a30', muted: '#68737c', line: '#d3dae0',
    wax: '#40607a', waxSoft: '#e0e9ef', waxInk: '#fdf8f0', scheme: 'light',
  },
  plain: {
    paper: '#ffffff', sheet: '#ffffff', card: '#f7f7f7',
    ink: '#111111', muted: '#6b6b6b', line: '#e5e5e5',
    wax: '#111111', waxSoft: '#eeeeee', waxInk: '#111111', scheme: 'light',
  },
}

export const THEMES: { id: ThemeId; name: string; desc: string }[] = [
  { id: 'letter', name: '旧信纸', desc: '现在的这套，米黄纸配陶土红' },
  { id: 'xuan', name: '宣纸', desc: '近乎白，墨很重，暖只剩一点点' },
  { id: 'stone', name: '青石', desc: '灰绿底配苔绿，冷而不刺' },
  { id: 'ink', name: '墨夜', desc: '深底暖字，晚上看不刺眼' },
  { id: 'moss', name: '苔痕', desc: '旧墙的绿，配深墨和一点赭' },
  { id: 'dusk', name: '傍晚', desc: '藕荷底配深红棕' },
  { id: 'rain', name: '雨后', desc: '淡青灰底配靛青' },
  { id: 'plain', name: '无印', desc: '纯白配近黑的墨，强调色也用墨' },
]

const IDS = THEMES.map((t) => t.id)
export const DEFAULT_THEME: ThemeId = 'letter'

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && (IDS as string[]).includes(v)
}

export function readTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME
  try {
    const raw = window.localStorage.getItem(THEME_KEY)
    return isThemeId(raw) ? raw : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

/** 把一套主题**内联**写到 <html> 上（内联必定赢 ✓）*/
export function applyTheme(id: ThemeId) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const pal = PALETTES[id] ?? PALETTES[DEFAULT_THEME]
  root.setAttribute('data-theme', id)
  const set = (k: string, v: string) => root.style.setProperty(k, v)

  // 我们自己的语义变量
  set('--paper', pal.paper)
  set('--sheet', pal.sheet)
  set('--card', pal.card)
  set('--ink', pal.ink)
  set('--muted', pal.muted)
  set('--line', pal.line)
  set('--wax', pal.wax)
  set('--wax-soft', pal.waxSoft)

  // 页面真正读的 daisyUI 角色变量（bg-base-100 / text-base-content …）
  set('--color-base-100', pal.sheet)
  set('--color-base-200', pal.paper)
  set('--color-base-300', pal.line)
  set('--color-base-content', pal.ink)
  set('--color-primary', pal.wax)
  set('--color-primary-content', pal.waxInk)
  set('--color-secondary', pal.muted)
  set('--color-secondary-content', pal.sheet)
  set('--color-accent', pal.wax)
  set('--color-accent-content', pal.sheet)
  set('--color-neutral', pal.ink)
  set('--color-neutral-content', pal.sheet)

  root.style.colorScheme = pal.scheme
}

/** 写本地 + 立刻生效 + 广播（任何一页改了，全站跟着变 ✓）*/
export function writeTheme(id: ThemeId) {
  try {
    window.localStorage.setItem(THEME_KEY, id)
  } catch {
    /* 隐私模式：至少这一次能用 */
  }
  applyTheme(id)
  window.dispatchEvent(new Event(THEME_KEY))
}

export function subscribeTheme(cb: () => void) {
  const onLocal = (e: Event) => {
    if (e instanceof StorageEvent && e.key !== null && e.key !== THEME_KEY) return
    cb()
  }
  window.addEventListener('storage', onLocal)
  window.addEventListener(THEME_KEY, onLocal)
  return () => {
    window.removeEventListener('storage', onLocal)
    window.removeEventListener(THEME_KEY, onLocal)
  }
}

export function serverTheme(): ThemeId {
  return DEFAULT_THEME
}
