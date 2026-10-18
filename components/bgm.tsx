'use client'

import { useEffect, useRef, useState } from 'react'
import { Icon } from './icons'

/**
 * 网页背景音乐（BGM）
 *
 * 设计要求（用户提的）：
 *   ① **默认不打开** —— 也让浏览器不会因为"自动播放"而报错（自动播放必须有用户手势）
 *   ② **可以自由开关** —— 右下角一个小圆钮，随时开/关
 *   ③ **主页右下角有个提示弹窗** —— 第一次来问一句"要不要放点音乐？"
 *
 * 实现要点：
 *   · 用 new Audio + preload='none'：**只有真的点了播放才下载**（这曲子 11MB，
 *     不能让它参与首屏，否则打开速度会被拖垮）
 *   · 开关状态记在本机 → 下次进来跟着上次的选择（开了就自动续上 ✓）
 *   · 提示只在一个会话里问一次（点了"不用"就不再烦你）
 *   · play() 可能被浏览器拒绝（没手势/被静音策略拦）→ 静默失败，不弹错误
 */

const ON_KEY = 'treehole:bgm'
const HINT_KEY = 'treehole:bgm-hint'

export function Bgm() {
  const [on, setOn] = useState(false)
  const [ready, setReady] = useState(false)
  const [hint, setHint] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // ① 恢复上次的选择（默认关）
  useEffect(() => {
    let saved = false
    try {
      saved = window.localStorage.getItem(ON_KEY) === '1'
    } catch {
      saved = false
    }
    // 用 setTimeout 让 setState 离开同步阶段（项目的 eslint 规则要求）
    window.setTimeout(() => {
      setOn(saved)
      setReady(true)
    }, 0)
  }, [])

  // ② 音频实例只建一次（preload=none → 不点播就不下载）
  useEffect(() => {
    const a = new Audio('/bgm.mp3')
    a.loop = true
    a.volume = 0.32
    a.preload = 'none'
    audioRef.current = a
    return () => {
      a.pause()
      audioRef.current = null
    }
  }, [])

  // ③ 跟随开关播放/暂停，并记住选择
  useEffect(() => {
    if (!ready) return
    const a = audioRef.current
    if (a) {
      if (on) {
        // 没手势时浏览器会拒绝 → 静默失败，不打扰用户
        void a.play().catch(() => {
          // 被浏览器拒绝（比如没有用户手势）→ 静默退回关闭状态
          window.setTimeout(() => setOn(false), 0)
        })
      } else {
        a.pause()
      }
    }
    try {
      window.localStorage.setItem(ON_KEY, on ? '1' : '0')
    } catch {
      /* 隐私模式忽略 */
    }
  }, [on, ready])

  // ④ 主页右下角的提示：没开音乐 + 这次会话没问过 → 等页面稳下来再问
  useEffect(() => {
    if (!ready || on) {
      // 延后执行：避免"effect 里同步 setState"（项目 lint 规则）
      window.setTimeout(() => setHint(false), 0)
      return
    }
    // 只在首页问（用 window.location 判断，避免 usePathname 的 Suspense 要求）
    if (typeof window === 'undefined' || window.location.pathname !== '/') {
      window.setTimeout(() => setHint(false), 0)
      return
    }
    let asked = false
    try {
      asked = window.sessionStorage.getItem(HINT_KEY) === '1'
    } catch {
      asked = false
    }
    if (asked) return
    // 等 2.5 秒：先让页面和过场稳下来，别一进来就弹
    const t = window.setTimeout(() => setHint(true), 2500)
    return () => window.clearTimeout(t)
  }, [ready, on])

  /** 提示里点"不用"：这个会话里不再问 */
  function dismissHint() {
    setHint(false)
    try {
      window.sessionStorage.setItem(HINT_KEY, '1')
    } catch {
      /* 忽略 */
    }
  }

  return (
    <>
      {/* 提示弹窗：主页右下角，等页面稳下来才出现 */}
      {hint && (
        <div className="animate-fade-in fixed bottom-24 right-4 z-40 w-56 rounded-box border border-base-300 bg-base-100/95 p-3 shadow-sm backdrop-blur">
          <p className="font-serif-cn text-[12px] leading-relaxed text-base-content/70">
            要不要放点音乐？开着它会一直循环，随时可以关。
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setOn(true)
                setHint(false)
              }}
              className="btn btn-primary btn-xs font-serif-cn"
            >
              放吧
            </button>
            <button
              type="button"
              onClick={dismissHint}
              className="text-[11.5px] text-base-content/50 transition hover:text-base-content/70"
            >
              不用了
            </button>
          </div>
        </div>
      )}

      {/* 常驻开关：右下角的小圆钮（这里才是真正的"自由打开/关闭"） */}
      <button
        type="button"
        onClick={() => {
          setOn((v) => !v)
          setHint(false)
        }}
        aria-label={on ? '关掉背景音乐' : '打开背景音乐'}
        title={on ? '关掉背景音乐' : '打开背景音乐'}
        className={`fixed bottom-4 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border transition ${
          on
            ? 'border-primary/30 bg-primary text-primary-content shadow-sm'
            : 'border-base-300 bg-base-100/90 text-base-content/55 backdrop-blur hover:text-base-content'
        }`}
      >
        <Icon name="music" className="h-4 w-4" />
      </button>
    </>
  )
}
