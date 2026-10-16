'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../app/lib/supabase'
import { Icon } from './icons'

/**
 * 「我的」里的展示页设置
 *
 * 展示页（/u/<你的 id>）是别人点你头像进来的地方，内容就是资料里的那些：
 * 头像、昵称、签名、状态、加入时间。这里只放一个开关 ——
 * 要不要把我在院子里公开说过的帖子列进去。
 *
 * **匿名帖永远不会出现在展示页**（页面那边就排除了），所以这个开关
 * 不涉及隐私泄露：它只管"公开说过的话"。
 */

const supabase = createClient()

export function ShowcaseSettingsSection({ userId }: { userId: string | null }) {
  const [showPosts, setShowPosts] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hint, setHint] = useState('')
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('show_posts_on_profile')
        .eq('id', userId)
        .maybeSingle()
      if (cancelled) return
      if (error) {
        if (/show_posts_on_profile|column/i.test(error.message)) setMissing(true)
        else console.error('读展示页开关失败:', error)
      } else {
        setShowPosts(
          (data as { show_posts_on_profile?: boolean } | null)?.show_posts_on_profile !== false,
        )
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  async function toggle(next: boolean) {
    if (!userId) return
    setSaving(true)
    setHint('')
    setShowPosts(next)
    const { data, error } = await supabase
      .from('profiles')
      .update({ show_posts_on_profile: next })
      .eq('id', userId)
      .select('id')
    setSaving(false)

    if (error || !data || data.length === 0) {
      setShowPosts(!next)
      setHint(
        /show_posts_on_profile|column/i.test(error?.message ?? '')
          ? '这个开关还没开通：先在 Supabase 里执行 supabase-profile-page.sql'
          : '没能保存：' + (error?.message ?? '没有权限'),
      )
      return
    }
    setHint(next ? '已开启：展示页里会列出你公开的帖子' : '已关闭：展示页只显示资料')
  }

  return (
    <section className="rounded-box border border-base-300 bg-base-100/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-base-content">展示页</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-base-content/60">
            每个朋友都有一个展示页：别人点你的头像能看到你的头像、昵称、签名、状态。
            内容就是下面资料里填的那些。
          </p>
        </div>
        {userId && (
          <Link
            href={`/u/${userId}`}
            className="flex flex-shrink-0 items-center gap-1 rounded-box border border-base-300 px-3 py-1.5 text-[11px] text-base-content/60 transition hover:border-[var(--accent-light)] hover:text-[var(--accent-deep)]"
          >
            <Icon name="user" className="h-3 w-3" />
            看看我的
          </Link>
        )}
      </div>

      <label className="mt-4 flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={showPosts}
          disabled={loading || saving || missing}
          onChange={(e) => void toggle(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--accent)] disabled:opacity-50"
        />
        <span className="min-w-0">
          <span className="block text-xs font-medium text-base-content">
            在展示页列出我公开的帖子
          </span>
          <span className="mt-0.5 block text-[11.5px] leading-relaxed text-base-content/60">
            只列院子里公开说过的话（最多 5 条）。
            <span className="text-[var(--accent-deep)]">匿名说的永远不会出现在展示页。</span>
          </span>
        </span>
      </label>

      {missing && (
        <p className="mt-3 rounded-box border border-base-300 bg-primary/5 px-3 py-2 text-[11.5px] leading-relaxed text-base-content/60">
          展示页还没开通：先在 Supabase 里执行 <code>supabase-profile-page.sql</code>。
          （没跑也能看展示页，只是少那个开关）
        </p>
      )}
      {hint && <p className="mt-2 text-[11.5px] text-base-content/60">{hint}</p>}
    </section>
  )
}
