'use client'

/**
 * 版本信息（放在「我的」页底部）
 *
 * 为什么需要它：
 *   遇到"页面乱 / 没样式"这类问题时，第一件要问的就是**内核版本**
 *   （iQOO/vivo 的国行机没有 Google Play，系统 WebView 常年不更新，
 *     低于 Chrome 111 时 Tailwind v4 的 @layer 会被整块丢掉 → 全站没样式）
 *   有了这一块，用户截一张图就知道是不是内核的问题
 *
 * 内核版本只能**在客户端**读（userAgent 服务端读不到），
 * 所以先渲染占位，挂载后再填 —— 避免服务端/客户端不一致的告警
 */

import { useEffect, useState } from 'react'

/** 每次发版改这里（网页版本） */
const WEB_VERSION = '1.2'

type Info = { engine: string; chrome: number | null; inApp: boolean }

export function VersionInfo() {
  const [info, setInfo] = useState<Info | null>(null)

  useEffect(() => {
    // 用 0 延迟避开「effect 里同步 setState」的规则，也避免连锁渲染
    const t = window.setTimeout(() => {
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
      const m = ua.match(/Chrome\/(\d+)/)
      const chrome = m ? Number(m[1]) : null
      // WebView 的 UA 里通常带 "; wv" —— 用来区分"在 App 里"还是"浏览器里"
      const inApp = /; wv\)/.test(ua) || /YourLettersApp/.test(ua)
      let engine: string
      if (chrome === null) engine = '未知（可能是很旧的内核）'
      else if (chrome >= 111) engine = 'Chrome ' + chrome
      else engine = 'Chrome ' + chrome + '（版本过低，建议更新 WebView）'
      setInfo({ engine, chrome, inApp })
    }, 0)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <div className="rounded-box border border-base-300 bg-base-100/60 p-4 text-[11px] leading-relaxed text-base-content/55">
      <p className="mb-1 font-medium text-base-content/70">版本信息</p>
      <p>网页版本：{WEB_VERSION}</p>
      <p>运行环境：{info ? (info.inApp ? 'App 内' : '浏览器') : '读取中…'}</p>
      <p>内核：{info ? info.engine : '读取中…'}</p>
    </div>
  )
}
