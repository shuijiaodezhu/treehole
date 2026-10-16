'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '../app/lib/supabase'
import { Icon } from './icons'

/**
 * 好感度（互动值）
 *
 * 机制（与 supabase-affinity.sql 一致）：
 *   · **有向**：从「我」到「你」。我跟你聊得越多，我对你的好感越高
 *   · **只增不减**：不做抖音火花那种「断了就消失」，不构成负担
 *   · 增长来源：私信 +1/条（每天最多 +20）、给 TA 朋友圈点赞 +2（每天最多 +10）
 *   · **默认只有自己看得到**；想让对方看到，去设置里开（profiles.affinity_public）
 *
 * 只显示一个数字。**不做段位**（"老朋友""知己"之类）——
 * 那样的名字太抽象，而且会把一个安静的数字变成攀比。
 * 想知道这个数怎么来的，鼠标停在上面会有一句说明。
 */

const supabase = createClient()

export type AffinityState = {
  /** 我对 TA 的好感度 */
  mine: number | null
  /** TA 对我的（他没公开的话是 null） */
  theirs: number | null
  loading: boolean
  /** 表还没建时不报错，只是不显示 */
  missing: boolean
  refresh: () => void
}

export function useAffinity(meId: string | null, friendId: string | null): AffinityState {
  /*
   * 取回来的数带着「这是哪一对」的标记（pairKey）。
   * 这样两件事都不用额外处理：
   *   · 换好友时，旧分数因为 key 对不上直接不显示（不会闪一下别人的数）
   *   · effect 里不需要同步 setState 去清空（那条会触发 react-hooks/set-state-in-effect）
   */
  const [fetched, setFetched] = useState<{
    pairKey: string
    mine: number
    theirs: number | null
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [missing, setMissing] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const pairKey = meId && friendId ? `${meId}:${friendId}` : null

  useEffect(() => {
    if (!meId || !friendId || !pairKey) return

    let cancelled = false
    void (async () => {
      setLoading(true)
      // 一次查两个方向：我→TA 永远读得到；TA→我 读不到就是没公开（RLS 会过滤掉）
      const { data, error } = await supabase
        .from('affinity')
        .select('from_id, to_id, score')
        .or(
          `and(from_id.eq.${meId},to_id.eq.${friendId}),and(from_id.eq.${friendId},to_id.eq.${meId})`,
        )

      if (cancelled) return

      if (error) {
        // 表还没建：不吵，安静地不显示
        if (/does not exist|PGRST205|schema cache|404/i.test(error.message)) setMissing(true)
        else console.error('读好感度失败:', error)
        setLoading(false)
        return
      }

      setMissing(false)
      const rows = (data ?? []) as { from_id: string; to_id: string; score: number }[]
      setFetched({
        pairKey,
        mine: rows.find((r) => r.from_id === meId)?.score ?? 0,
        theirs: rows.find((r) => r.from_id === friendId)?.score ?? null,
      })
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [meId, friendId, pairKey, reloadKey])

  // key 对不上就当没有（换人了 / 还没回来）
  const fresh = fetched && fetched.pairKey === pairKey ? fetched : null

  return {
    mine: pairKey ? (fresh?.mine ?? null) : null,
    theirs: pairKey ? (fresh?.theirs ?? null) : null,
    loading,
    missing,
    refresh: useCallback(() => setReloadKey((k) => k + 1), []),
  }
}

/**
 * 一次取回「我对所有好友」的好感度（好友列表要用）
 *
 * 只查 from_id = 我 这一侧：列表里显示的是"我对他的好感"，
 * 别人的那一侧受隐私限制（他没公开就读不到），列表里也不该显示。
 * 表还没建时不报错，返回空表即可。
 */
export function useAffinityMap(meId: string | null): {
  scores: Record<string, number>
  refresh: () => void
} {
  const [scores, setScores] = useState<Record<string, number>>({})
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!meId) return
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('affinity')
        .select('to_id, score')
        .eq('from_id', meId)

      if (cancelled) return
      if (error) {
        if (!/does not exist|PGRST205|schema cache|404/i.test(error.message)) {
          console.error('批量读好感度失败:', error)
        }
        return
      }

      const next: Record<string, number> = {}
      for (const row of (data ?? []) as { to_id: string; score: number }[]) {
        next[row.to_id] = row.score
      }
      setScores(next)
    })()
    return () => {
      cancelled = true
    }
  }, [meId, reloadKey])

  return { scores, refresh: useCallback(() => setReloadKey((k) => k + 1), []) }
}

/** 本地偏好：关掉之后聊天抬头就不显示好感度（默认开） */
const HIDE_KEY = (uid: string) => `treehole:affinity:hidden:${uid}`

export function readAffinityHidden(uid: string): boolean {
  try {
    return window.localStorage.getItem(HIDE_KEY(uid)) === '1'
  } catch {
    return false
  }
}

export function writeAffinityHidden(uid: string, hidden: boolean): void {
  try {
    window.localStorage.setItem(HIDE_KEY(uid), hidden ? '1' : '0')
  } catch {
    /* 隐私模式忽略 */
  }
}

/**
 * 设置页里的一节：两个开关
 *
 *   · 显示好感度（**只是本机偏好**，放 localStorage）—— 关掉后聊天抬头不再显示
 *   · 让 TA 看到我对 TA 的好感度（**写进 profiles.affinity_public**，默认关）
 *
 * 分开两个开关是有意的：「我不想看」和「我不想被看」是两件事。
 */
export function AffinitySettingsSection({ userId }: { userId: string | null }) {
  const [hidden, setHidden] = useState(false)
  const [isPublic, setIsPublic] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hint, setHint] = useState('')
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHidden(readAffinityHidden(userId))
    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('affinity_public')
        .eq('id', userId)
        .maybeSingle()
      if (cancelled) return
      if (error) {
        if (/affinity_public|column/i.test(error.message)) setMissing(true)
        else console.error('读好感度开关失败:', error)
      } else {
        setIsPublic(Boolean((data as { affinity_public?: boolean } | null)?.affinity_public))
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  async function togglePublic(next: boolean) {
    if (!userId) return
    setSaving(true)
    setHint('')
    setIsPublic(next)
    const { data, error } = await supabase
      .from('profiles')
      .update({ affinity_public: next })
      .eq('id', userId)
      .select('id')
    setSaving(false)

    if (error || !data || data.length === 0) {
      setIsPublic(!next)
      setHint(
        /affinity_public|column/i.test(error?.message ?? '')
          ? '这个开关还没开通：先在 Supabase 里执行 supabase-affinity.sql'
          : '没能保存：' + (error?.message ?? '没有权限'),
      )
      return
    }
    setHint(next ? '已开启：对方能看到你对他的好感度' : '已关闭：只有你自己看得到')
  }

  return (
    <section className="rounded-box border border-base-300 bg-base-100 p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/5">
          <Icon name="heart" className="h-4 w-4 text-[var(--accent-deep)]" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-base-content">好感度</h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-base-content/60">
            你和每个朋友来往留下的痕迹：聊天、点赞都会加一点，只增不减，
            不催你天天说话。
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {/* 本机偏好 */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!hidden}
            onChange={(e) => {
              if (!userId) return
              const nextHidden = !e.target.checked
              setHidden(nextHidden)
              writeAffinityHidden(userId, nextHidden)
            }}
            className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
          />
          <span className="min-w-0">
            <span className="block text-xs font-medium text-base-content">在聊天里显示好感度</span>
            <span className="mt-0.5 block text-[11.5px] leading-relaxed text-base-content/60">
              只是你自己这台设备上的显示偏好。关掉之后，聊天抬头不再出现那个数字。
            </span>
          </span>
        </label>

        {/* 是否让对方看到 */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isPublic}
            disabled={loading || saving || missing}
            onChange={(e) => void togglePublic(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--accent)] disabled:opacity-50"
          />
          <span className="min-w-0">
            <span className="block text-xs font-medium text-base-content">
              让朋友看到我对他的好感度
            </span>
            <span className="mt-0.5 block text-[11.5px] leading-relaxed text-base-content/60">
              默认关闭：只有你自己看得到。开启后，对方在聊天抬头能看到你那一侧的分数；
              其他人任何时候都看不到。
            </span>
          </span>
        </label>

        {missing && (
          <p className="rounded-box border border-base-300 bg-primary/5 px-3 py-2 text-[11.5px] leading-relaxed text-base-content/60">
            好感度还没开通：先在 Supabase 里执行 <code>supabase-affinity.sql</code>。
            （没跑也不影响别的功能，只是不显示这个数）
          </p>
        )}
        {hint && <p className="text-[11.5px] text-base-content/60">{hint}</p>}
      </div>
    </section>
  )
}
/**
 * 聊天抬头右侧那个小数字
 *
 * 就是一个图标加一个数字，没有底、没有框、不弹层：
 * 鼠标停上去用浏览器原生的 title 说明它是怎么涨的（原生提示不会"悬空居中"）。
 * 心形用图标组件而不是 ♥ 字符 —— 免得某些字体缺字形显示成方块。
 */
export function AffinityScore({
  amount,
  friendName,
}: {
  amount: number | null
  friendName: string
}) {
  if (amount === null || amount <= 0) return null
  return (
    <span
      title={`你和 ${friendName} 来往留下的痕迹：聊一句 +1（每天最多 20），给他的朋友圈点个赞 +2（每天最多 10）。不会减少，也不催你天天说话。`}
      className="ml-auto flex flex-shrink-0 cursor-default select-none items-center gap-1 font-serif-cn text-[11px] leading-none text-[var(--accent-light)]"
    >
      <Icon name="heart" className="h-3 w-3" />
      {amount}
    </span>
  )
}
