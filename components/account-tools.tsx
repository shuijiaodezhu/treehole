'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '../app/lib/supabase'
import { Icon } from './icons'
import { relativeTime } from './login-log'

/**
 * 账号相关的三件事：④ 数据导出、③ 注销申请、以及管理端的注销列表
 *
 * ④ 导出：把自己在各表里的行全部拉下来，打包成一个 JSON 下载。
 *    有几张表可能因为策略或字段变动读不到——**不静默吞掉**，
 *    会在结果里列出哪几张没导出成功，用户自己心里有数。
 *
 * ③ 注销：真正的「删掉 auth 用户」需要 service_role 权限，
 *    **前端做不到**（也不该把那种钥匙放进浏览器）。所以走申请：
 *    用户提交 → 落一行 deletion_requests → 站主在后台看到 → 去 Supabase 删。
 *    这一点在界面上如实写明，不让用户以为点一下就删干净了。
 */

const supabase = createClient()

const EXPORT_TABLES: { name: string; column: string; label: string }[] = [
  { name: 'profiles', column: 'id', label: '我的资料' },
  { name: 'friend_posts', column: 'author_id', label: '朋友圈动态' },
  { name: 'world_posts', column: 'author_id', label: '院子里的帖子' },
  { name: 'world_comments', column: 'author_id', label: '院子里的回复' },
  { name: 'messages', column: 'sender_id', label: '我发出的私信' },
  { name: 'winter_letters', column: 'thread_user_id', label: '冬日信箱' },
]

type ExportResult = {
  ok: boolean
  message: string
  failures?: string[]
}

async function exportMyData(userId: string, email: string | null): Promise<ExportResult> {
  const tables: Record<string, unknown[]> = {}
  const failures: string[] = []

  for (const t of EXPORT_TABLES) {
    const { data, error } = await supabase.from(t.name).select('*').eq(t.column, userId)
    if (error) {
      // 表还没建、字段名变了、策略不让读 —— 都归到这里，如实列出
      failures.push(`${t.label}（${t.name}）：${error.message}`)
      continue
    }
    tables[t.name] = data ?? []
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    note: '这是你在树洞里留下的内容。私信只包含你自己发出的那一侧；信箱包含你和站主的往来。',
    account: { id: userId, email },
    tables,
    notExported: failures,
  }

  try {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    a.href = url
    a.download = `treehole-我的数据-${stamp}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('导出失败:', err)
    return { ok: false, message: '生成文件失败，换个浏览器试试' }
  }

  const count = Object.values(tables).reduce((sum, rows) => sum + rows.length, 0)
  return {
    ok: true,
    message: `已导出 ${count} 条${failures.length > 0 ? `，另有 ${failures.length} 类没导出来` : ''}`,
    failures,
  }
}

/* ==================== ④ 导出 ==================== */

export function ExportDataSection({ userId, email }: { userId: string | null; email: string | null }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ExportResult | null>(null)

  return (
    <section className="rounded-box border border-base-300 bg-base-100 p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/5">
          <Icon name="download" className="h-4 w-4 text-[var(--accent-deep)]" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-base-content">导出我的数据</h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-base-content/60">
            把你写过的动态、帖子、回复、私信和信箱，打包成一个 JSON 文件下载。
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled={!userId || busy}
        onClick={async () => {
          if (!userId) return
          setBusy(true)
          setResult(await exportMyData(userId, email))
          setBusy(false)
        }}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs text-white transition hover:shadow-sm disabled:opacity-50"
      >
        <Icon name="download" className="h-3.5 w-3.5" />
        {busy ? '整理中…' : '导出为 JSON'}
      </button>

      {result && (
        <div className="mt-3">
          <p className={`text-[11px] ${result.ok ? 'text-base-content' : 'text-red-500'}`}>{result.message}</p>
          {result.failures && result.failures.length > 0 && (
            <ul className="mt-2 space-y-1 rounded-box border border-base-300 bg-primary/5 px-3 py-2">
              {result.failures.map((f) => (
                <li key={f} className="text-[11px] leading-relaxed text-base-content/60">
                  {f}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

/* ==================== ③ 注销申请 ==================== */

export function DeleteAccountSection({ userId }: { userId: string | null }) {
  const [step, setStep] = useState<'idle' | 'confirm' | 'done'>('idle')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!userId) return
    setBusy(true)
    setError('')
    try {
      const { data, error: insertError } = await supabase
        .from('deletion_requests')
        .insert({ user_id: userId, reason: reason.trim() || null })
        .select('id')
        .single()
      if (insertError) throw insertError
      // 受 RLS 影响时不会报错但也不会有行
      if (!data) throw new Error('没有写入成功，可能策略还没建')
      setStep('done')
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err)
      setError(
        /does not exist|PGRST205|schema cache|404/i.test(msg)
          ? '注销申请还没开通：先在 Supabase 里执行 supabase-security.sql'
          : '提交失败：' + msg,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-box border border-base-300 bg-base-100 p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-base-100">
          <Icon name="alert" className="h-4 w-4 text-base-content" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-base-content">注销账号</h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-base-content/60">
            想走的话，提交一下就行，站主会替你删干净。
          </p>
        </div>
      </div>

      {step === 'idle' && (
        <button
          type="button"
          onClick={() => setStep('confirm')}
          className="mt-4 rounded-full border border-base-300 bg-base-100 px-4 py-2 text-xs text-base-content transition hover:bg-base-100"
        >
          我要注销
        </button>
      )}

      {step === 'confirm' && (
        <div className="mt-4 rounded-box border border-base-300 bg-base-100 px-4 py-4">
          <p className="text-[11.5px] leading-relaxed text-base-content">
            提交后，站主会收到一条申请，然后去后台把你的账号和内容一起删掉。
            <br />
            <span className="text-base-content/60">
              在你收到确认之前，账号还能照常使用；想反悔就告诉站主一声。
            </span>
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="想说的话（可以留空）"
            className="mt-3 w-full resize-none rounded-box border border-base-300 bg-base-100 px-3 py-2 text-[12px] text-base-content placeholder:text-base-content/60 focus:border-base-300 focus:outline-none"
          />
          {error && <p className="mt-2 text-[11.5px] text-red-500">{error}</p>}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="rounded-full bg-primary px-4 py-2 text-xs text-white transition hover:bg-primary disabled:opacity-50"
            >
              {busy ? '提交中…' : '确认提交'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('idle')
                setError('')
              }}
              className="rounded-full border border-base-300 bg-base-100 px-4 py-2 text-xs text-base-content/60 transition"
            >
              再想想
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <p className="mt-4 rounded-box border border-base-300 bg-primary/5 px-4 py-3 text-[11.5px] leading-relaxed text-base-content/60">
          申请已提交。站主看到后会处理，删完会告诉你一声。
          <br />
          在那之前，账号照常可用——想留下的话，跟站主说一声就行。
        </p>
      )}
    </section>
  )
}

/* ==================== 管理端：注销申请 ==================== */

export type DeletionRequest = {
  id: string
  user_id: string
  reason: string | null
  status: string
  created_at: string
}

export function useDeletionRequests(adminId: string) {
  const [rows, setRows] = useState<DeletionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const { data, error: loadError } = await supabase
        .from('deletion_requests')
        .select('id, user_id, reason, status, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
      if (cancelled) return
      if (loadError) {
        setError(
          /does not exist|PGRST205|schema cache|404/i.test(loadError.message)
            ? '还没开通：先在 Supabase 里执行 supabase-security.sql'
            : '读取失败：' + loadError.message,
        )
        setRows([])
      } else {
        setError('')
        setRows((data ?? []) as DeletionRequest[])
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const markDone = useCallback(
    async (id: string) => {
      const { data, error: updateError } = await supabase
        .from('deletion_requests')
        .update({ status: 'done', handled_by: adminId, handled_at: new Date().toISOString() })
        .eq('id', id)
        .select('id')
      if (updateError || !data || data.length === 0) {
        setError('标记失败：' + (updateError?.message ?? '没有权限（策略未建）'))
        return
      }
      setRows((prev) => prev.filter((r) => r.id !== id))
    },
    [adminId],
  )

  return { rows, loading, error, reload: () => setReloadKey((k) => k + 1), markDone }
}

/** 管理端：待处理的注销申请 */
export function DeletionRequestsSection({ adminId }: { adminId: string }) {
  const { rows, loading, error, reload, markDone } = useDeletionRequests(adminId)
  const [names, setNames] = useState<Record<string, string>>({})

  // 顺手把昵称查出来，方便认人（注销是账号级的事，不涉及信箱的匿名）
  useEffect(() => {
    if (rows.length === 0) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, nickname, username')
        .in('id', rows.map((r) => r.user_id))
      if (cancelled || !data) return
      const map: Record<string, string> = {}
      for (const p of data as { id: string; nickname: string | null; username: string | null }[]) {
        map[p.id] = p.nickname || p.username || ''
      }
      setNames(map)
    })()
    return () => {
      cancelled = true
    }
  }, [rows])

  return (
    <section className="mb-6 rounded-box border border-base-300 bg-base-100/80 p-6 backdrop-blur shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-base-100">
          <Icon name="alert" className="h-4 w-4 text-base-content" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-baseline gap-2 text-sm font-semibold text-base-content">
            注销申请
            {rows.length > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-normal text-white">
                {rows.length} 条待处理
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-base-content/40">
            删人要去 Supabase → Authentication → Users 里按 id 找到并删除；
            这里只负责记录申请、并标记已处理
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          className="inline-flex items-center gap-1 rounded-box border border-base-300 bg-base-100 px-3 py-1.5 text-xs text-base-content/60 transition hover:bg-primary/5"
        >
          <Icon name="refresh" className="h-3.5 w-3.5" />
          刷新
        </button>
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="py-6 text-center text-xs text-base-content/40">读取中…</p>
        ) : error ? (
          <p className="rounded-box border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-600">{error}</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-xs text-base-content/40">没有待处理的注销申请</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-box border border-base-300 bg-base-100 px-4 py-3"
              >
                <span className="text-xs font-medium text-base-content">
                  {names[r.user_id] || '（没查到昵称）'}
                </span>
                <code className="select-all rounded bg-base-100 px-2 py-0.5 text-[11px] text-base-content/60">
                  {r.user_id}
                </code>
                <span className="text-[11px] text-base-content/40">{relativeTime(r.created_at)}</span>
                {r.reason && (
                  <span className="w-full text-[11.5px] leading-relaxed text-base-content/60">「{r.reason}」</span>
                )}
                <button
                  type="button"
                  onClick={() => void markDone(r.id)}
                  className="ml-auto rounded-full border border-base-300 bg-base-100 px-3 py-1.5 text-[11px] text-[var(--accent-deep)] transition hover:bg-primary/5"
                >
                  已处理
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
