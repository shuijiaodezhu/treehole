'use client'

/**
 * 主题（换的是"纸、卡、墨、线、强调色"，不换"每个地方自己的颜色"）
 *
 * 借鉴 taste-skill 的做法：
 *   · 颜色只通过角色变量使用（--paper / --sheet / --card / --ink / --muted / --line / --wax）
 *   · 一套主题就是这几个值 —— 组件里不出现第二个调色板
 *   · 「米黄 + 陶土红」是最容易被认出来的生成观感，
 *     所以除了你现在这套，另外给了几套"暖但不像 AI"的、暗的、冷的、极简的
 *
 * 落在 <html data-theme="…">，值在 globals.css 里（[data-theme="…"] { … }）
 */

export const THEME_KEY = 'treehole:theme'

export type ThemeId =
  | 'letter' | 'xuan' | 'stone' | 'ink' | 'moss' | 'dusk' | 'rain' | 'plain'

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

export function readTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME
  try {
    const raw = window.localStorage.getItem(THEME_KEY)
    return IDS.includes(raw as ThemeId) ? (raw as ThemeId) : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

/** 写到 <html> 上；同时存本地。任何一页改了，全站立刻跟着变 ✓ */
export function writeTheme(id: ThemeId) {
  try {
    window.localStorage.setItem(THEME_KEY, id)
  } catch {
    /* 隐私模式下写不了：至少这一次能用 */
  }
  applyTheme(id)
  window.dispatchEvent(new Event(THEME_KEY))
}

export function applyTheme(id: ThemeId) {
  try {
    document.documentElement.dataset.theme = id
  } catch {
    /* 忽略 */
  }
}

/** 挂一次：进站时把存下来的主题贴到 <html> 上 */
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
