'use client'

import Link from 'next/link'
import invite from '../../content/invite.json'
import { BackLink } from '../../components/back-link'
import { pageAccentVars } from '../../components/theme'

/**
 * 《你的来信》邀请信 —— 独立的一页：yourletters.cn/invite
 *
 * 内容来自 content/invite.json（由「你的来信-邀请信.docx」提取 ✓）
 * 保留原来的结构：大标题/小标题/正文/列表/加粗/居中 ✓
 * 样式沿用站的字体与配色（暖纸 + 宋体 + 朱砂）✓ 不做花哨排版
 */

type Run = { t: string; b: boolean }
type Block = { type: 'p' | 'h1' | 'h2' | 'li'; runs: Run[]; align: string | null }

function Runs({ runs }: { runs: Run[] }) {
  return (
    <>
      {runs.map((r, i) =>
        r.b ? (
          <strong key={i} className="font-semibold text-base-content">
            {r.t}
          </strong>
        ) : (
          <span key={i}>{r.t}</span>
        ),
      )}
    </>
  )
}

export default function InvitePage() {
  const blocks = invite as Block[]

  return (
    <div className="min-h-screen bg-[var(--paper)]" style={pageAccentVars('home')}>
      <div className="mx-auto max-w-2xl px-6 py-10">
        <BackLink fallback="/" label="← 回首页" />

        <article className="mt-8 space-y-3 font-serif-cn text-[13px] leading-[1.95] text-base-content/85">
          {blocks.map((b, i) => {
            const centered = b.align === 'CENTER'
            const key = `b${i}`

            if (b.type === 'h1') {
              return (
                <h1
                  key={key}
                  className="mt-9 mb-2 border-b border-base-300 pb-2 font-serif-cn text-[17px] font-semibold tracking-wide text-base-content first:mt-0"
                >
                  <Runs runs={b.runs} />
                </h1>
              )
            }
            if (b.type === 'h2') {
              return (
                <h2
                  key={key}
                  className="mt-7 mb-1.5 font-serif-cn text-[14.5px] font-semibold text-primary"
                >
                  <Runs runs={b.runs} />
                </h2>
              )
            }
            if (b.type === 'li') {
              return (
                <p key={key} className="flex gap-2 pl-1">
                  <span className="flex-shrink-0 text-primary/70">·</span>
                  <span className="min-w-0 flex-1">
                    <Runs runs={b.runs} />
                  </span>
                </p>
              )
            }
            return (
              <p key={key} className={centered ? 'text-center' : undefined}>
                <Runs runs={b.runs} />
              </p>
            )
          })}
        </article>

        {/* 页尾：一句收束 + 回站 */}
        <div className="mt-12 border-t border-base-300 pt-6 text-center">
          <p className="font-serif-cn text-[12px] text-base-content/60">
            世界是一封寄丢的信，我这里有一封专门为你留着。
          </p>
          <div className="mt-4 flex items-center justify-center gap-4 text-[12px]">
            <Link href="/register" className="text-primary hover:underline">
              去注册
            </Link>
            <span className="text-base-content/30">·</span>
            <Link href="/" className="text-base-content/60 hover:text-primary">
              回首页
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
