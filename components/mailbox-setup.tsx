'use client'

import { useState } from 'react'
import { Icon } from './icons'
import { WINTER_MAILBOX_SQL } from './winter-mailbox-sql'

/**
 * 「信箱还没开通」时给的自助面板
 *
 * 出现的唯一原因是 winter_letters 表还不存在（PostgREST 会回 404 / PGRST205）。
 * 建表只能由站主在 Supabase 里执行 SQL——前端没有这个权限。
 * 所以这里把该做的事直接摆在页面上：SQL 全文 + 一键复制 + 重新检查，
 * 免得对着「稍后再试」发愣。
 */

export function MailboxSetup({ onRetry, accent = 'warm' }: { onRetry: () => void; accent?: 'warm' | 'purple' }) {
  const [copied, setCopied] = useState(false)
  const [showSql, setShowSql] = useState(false)

  const tone =
    accent === 'purple'
      ? {
          panel: 'border-base-300 bg-base-100',
          title: 'text-base-content',
          body: 'text-base-content/60',
          btn: 'border-base-300 bg-base-100 text-base-content/60 hover:bg-base-content/5',
          primary: 'bg-gradient-to-r from-primary/20 to-primary/10 text-white',
        }
      : {
          panel: 'border-base-300 bg-base-content/5',
          title: 'text-base-content',
          body: 'text-base-content/60',
          btn: 'border-base-300 bg-base-100 text-primary hover:bg-base-100/80',
          primary: 'bg-primary text-white',
        }

  async function copy() {
    try {
      await navigator.clipboard.writeText(WINTER_MAILBOX_SQL)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      // 剪贴板不可用就展开让手动复制
      setShowSql(true)
    }
  }

  return (
    <div className={`rounded-box border px-4 py-4 ${tone.panel}`}>
      <p className={`font-serif-cn text-[12.5px] ${tone.title}`}>信箱还没开通</p>
      <p className={`mt-1.5 font-serif-cn text-[11px] leading-relaxed ${tone.body}`}>
        只差一步：在 Supabase 里建一张属于信箱自己的表。
        <br />
        （和好友私聊完全分开，互不影响）
      </p>

      <ol className={`mt-3 space-y-1 font-serif-cn text-[11px] leading-relaxed ${tone.body}`}>
        <li>1 · 打开 Supabase → SQL Editor → New query</li>
        <li>2 · 粘贴下面这段 SQL，点 Run</li>
        <li>3 · 回来点「重新检查」</li>
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void copy()}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-serif-cn text-[11.5px] transition ${tone.primary}`}
        >
          <Icon name={copied ? 'check' : 'copy'} className="h-3.5 w-3.5" />
          {copied ? '已复制' : '复制 SQL'}
        </button>
        <button
          type="button"
          onClick={() => setShowSql((v) => !v)}
          className={`rounded-full border px-3.5 py-1.5 font-serif-cn text-[11.5px] transition ${tone.btn}`}
        >
          {showSql ? '收起' : '看 SQL 全文'}
        </button>
        <button
          type="button"
          onClick={onRetry}
          className={`rounded-full border px-3.5 py-1.5 font-serif-cn text-[11.5px] transition ${tone.btn}`}
        >
          重新检查
        </button>
      </div>

      {showSql && (
        <pre className="mt-3 max-h-64 overflow-auto rounded-box border border-black/5 bg-base-100/80 p-3 text-[11px] leading-relaxed text-base-content">
          {WINTER_MAILBOX_SQL}
        </pre>
      )}
    </div>
  )
}
