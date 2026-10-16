'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../app/lib/supabase'
import { Icon } from './icons'

/**
 * ④ 登录日志 + ⑤ 设备管理
 *
 * 每次登录成功往 login_logs 写一条（含浏览器 UA），
 * 设置页里把最近的几条列出来，显示成「Windows · Chrome」这种人看得懂的样子。
 *
 * 隐私：RLS 只允许读自己的记录，也只允许写自己的（supabase-security.sql）。
 * 表还没建时不会报错刷屏，只是列不出来并给一句可操作的提示。
 */

const supabase = createClient()

export type LoginRecord = {
  id: string
  user_agent: string | null
  created_at: string
}

/** 把 UA 说成人话 */
function describeDevice(ua: string | null | undefined): string {
  if (!ua) return '未知设备'
  const s = ua

  let os = '未知系统'
  if (/Windows NT 10|Windows NT 11/.test(s)) os = 'Windows'
  else if (/Windows/.test(s)) os = 'Windows'
  else if (/iPhone|iPad|iPod/.test(s)) os = 'iPhone / iPad'
  else if (/Android/.test(s)) os = 'Android'
  else if (/Mac OS X|Macintosh/.test(s)) os = 'macOS'
  else if (/Linux/.test(s)) os = 'Linux'

  let browser = '未知浏览器'
  if (/Edg\//.test(s)) browser = 'Edge'
  else if (/OPR\/|Opera/.test(s)) browser = 'Opera'
  else if (/Firefox\//.test(s)) browser = 'Firefox'
  else if (/Chrome\//.test(s)) browser = 'Chrome'
  else if (/Safari\//.test(s)) browser = 'Safari'

  return `${os} · ${browser}`
}

/** 相对时间：刚刚 / 3 分钟前 / 昨天 18:20 / 8月14日 */
export function relativeTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  const d = new Date(iso)
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (diff < 172_800_000) return `昨天 ${hm}`
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`
}

function isMissingTable(err: unknown): boolean {
  const text =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err)
  return /does not exist|PGRST205|schema cache|404/i.test(text)
}

/** 登录成功后调用；失败不打扰用户（只是少一条记录） */
export async function logLogin(userId: string): Promise<void> {
  try {
    await supabase.from('login_logs').insert({
      user_id: userId,
      user_agent: typeof navigator === 'undefined' ? null : navigator.userAgent.slice(0, 300),
    })
  } catch (err) {
    console.warn('登录记录没写进去（可能还没跑 supabase-security.sql）:', err)
  }
}

async function loadLogins(userId: string, limit = 8): Promise<{ records: LoginRecord[]; missing: boolean }> {
  const { data, error } = await supabase
    .from('login_logs')
    .select('id, user_agent, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingTable(error)) return { records: [], missing: true }
    console.error('读取登录记录失败:', error)
    return { records: [], missing: false }
  }
  return { records: (data ?? []) as LoginRecord[], missing: false }
}

/** 设置页里的「登录设备」一节 */
export function LoginDevicesSection({ userId }: { userId: string | null }) {
  const [records, setRecords] = useState<LoginRecord[]>([])
  const [missing, setMissing] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void (async () => {
      const result = await loadLogins(userId)
      if (cancelled) return
      setRecords(result.records)
      setMissing(result.missing)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  return (
    <section className="rounded-box border border-base-300 bg-base-100 p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/5">
          <Icon name="shield" className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-base-content">登录设备</h2>
          <p className="mt-0.5 text-[11px] text-base-content/60">
            最近在这些设备上登录过。看到不认识的，建议改密码。
          </p>
        </div>
      </div>

      <div className="mt-5">
        {loading ? (
          <p className="py-6 text-center text-xs text-base-content/60">读取中…</p>
        ) : missing ? (
          <p className="rounded-box border border-base-300 bg-primary/5 px-4 py-3 text-[11px] leading-relaxed text-base-content/60">
            登录记录还没开通：先在 Supabase 里执行 <code>supabase-security.sql</code>，
            之后每次登录都会自动记下来。
          </p>
        ) : records.length === 0 ? (
          <p className="py-6 text-center text-xs text-base-content/60">
            还没有记录。从下次登录开始就会出现在这里。
          </p>
        ) : (
          <ul className="divide-y divide-[var(--accent-line)]">
            {records.map((r, i) => (
              <li key={r.id} className="flex items-center gap-3 py-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/5">
                  <Icon name={/iPhone|iPad|Android/i.test(r.user_agent ?? '') ? 'user' : 'box'} className="h-3.5 w-3.5 text-base-content/60" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-xs font-medium text-base-content">{describeDevice(r.user_agent)}</span>
                    {i === 0 && (
                      <span className="rounded-full bg-primary/5 px-2 py-0.5 text-[11px] text-primary">
                        本次
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-base-content/60">{relativeTime(r.created_at)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
