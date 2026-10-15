'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../app/lib/supabase'
import { Icon } from './icons'
import { ADMIN_UUID } from './utils'

/**
 * 后台：停用 / 解封账号
 *
 * 之前只能去 Supabase 后台手动 Ban —— 而《举报处理流程》写着"在后台手动做"，
 * 等于承认没有工具。现在这一块直接调 `admin_set_ban` 函数
 * （supabase-admin-ban.sql），它改的是 auth.users.banned_until，
 * 也就是 Supabase 网关层的真封禁：被封的人登录不上、拿着旧 token 也调不动接口。
 *
 * 函数体里会再检查一次"调用者是不是站主"，所以就算有人改了前端 JS 来点这个按钮，
 * 数据库那边也会拒绝。
 */

const supabase = createClient()

type Found = {
  id: string
  nickname: string | null
  username: string | null
  email?: string | null
}

export function UserBanSection({ adminId }: { adminId: string }) {
  const [keyword, setKeyword] = useState('')
  const [found, setFound] = useState<Found[]>([])
  const [searched, setSearched] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [hint, setHint] = useState('')

  /*
   * 最近注册的 20 人：搜索框空着时先列出来。
   * 站主要封的人常常就在最近注册的里面，让他不用先猜昵称。
   */
  async function loadRecent() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nickname, username')
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) {
      console.error('读最近用户失败:', error)
      return
    }
    setFound((data ?? []) as Found[])
  }

  useEffect(() => {
    if (adminId !== ADMIN_UUID) return
    void (async () => {
      await loadRecent()
    })()
  }, [adminId])

  /** 看起来像 uuid 就按 id 精确查（后台的注销申请、举报记录里都能看到 id） */
  const looksLikeId = (w: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(w)

  async function search() {
    const word = keyword.trim()
    setSearched(Boolean(word))
    setHint('')
    if (!word) {
      await loadRecent()
      return
    }

    const query = supabase.from('profiles').select('id, nickname, username')
    const { data, error } = looksLikeId(word)
      ? await query.eq('id', word).limit(5)
      : await query
          .or(`nickname.ilike.%${word}%,username.ilike.%${word}%`)
          .limit(10)

    if (error) {
      setHint('搜索失败：' + error.message)
      setFound([])
      return
    }
    setFound((data ?? []) as Found[])
  }

  async function setBan(target: Found, days: number) {
    const label = days <= 0 ? '解除封禁' : days >= 36500 ? '永久停用' : `停用 ${days} 天`
    const who = target.nickname || target.username || target.id

    let reason: string | null = null
    if (days > 0) {
      reason = window.prompt(`${label}：${who}\n\n原因（会发给对方看，可以留空）：`, '违反了《社区公约》')
      if (reason === null) return
    } else if (!confirm(`确定解除 ${who} 的封禁吗？`)) {
      return
    }

    setBusy(target.id)
    setHint('')

    const { error } = await supabase.rpc('admin_set_ban', {
      p_target: target.id,
      p_days: days,
      p_reason: reason,
    })

    setBusy(null)

    if (error) {
      setHint(
        /admin_set_ban|function .* does not exist|schema cache/i.test(error.message)
          ? '还没开通：先在 Supabase 里执行 supabase-admin-ban.sql'
          : '操作失败：' + error.message,
      )
      return
    }

    setHint(days > 0 ? `已${label}：${who}` : `已解除：${who}`)
  }

  if (adminId !== ADMIN_UUID) return null

  return (
    <section className="rounded-2xl border border-[#f0e6dc] bg-white/80 p-4">
      <h2 className="text-xs tracking-wider text-[#8a7a9a]">用户管理 · 停用账号</h2>
      <p className="mt-2 text-[11.5px] leading-relaxed text-[#8a7a9a]">
        停用是真的封禁（改 auth 里的 banned_until），被封的人登录不上、
        旧登录态也会失效。解除后可以立刻重新登录。
      </p>

      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value)
            if (!e.target.value.trim()) setSearched(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void search()
          }}
          placeholder="按昵称或用户名搜"
          className="min-w-0 flex-1 rounded-xl border border-[#f0e6dc] bg-[#fdfaf7] px-3 py-2 text-xs text-[#3a3229] placeholder:text-[#c3b3a5] focus:border-[#e0a184] focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void search()}
          className="rounded-xl bg-[#d97757] px-3 py-2 text-xs text-white transition hover:opacity-90"
        >
          搜索
        </button>
      </div>

      {found.length === 0 && (
        <p className="mt-3 text-[11px] leading-relaxed text-[#8a7a9a]">
          没找到这个人。昵称要写得完整一些；也可以直接粘贴他的**用户 id**
          （后台的「注销申请」「举报」里都能看到 id）。
          {' '}
          <span className="text-[#b0a89e]">
            邮箱搜不了 —— 邮箱在 auth 里，前端读不到，要按邮箱找请去 Supabase →
            Authentication → Users。
          </span>
        </p>
      )}

      {found.length > 0 && (
        <p className="mt-3 text-[11px] text-[#b0a89e]">
          {searched ? `搜索结果 ${found.length} 人` : '最近注册的 20 人（在下面直接点）'}
        </p>
      )}

      {found.length > 0 && (
        <ul className="mt-3 space-y-2">
          {found.map((person) => (
            <li
              key={person.id}
              className="rounded-xl border border-[#f4ece4] bg-[#fffdfb] px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-xs text-[#3a3229]">
                    {person.nickname || person.username || '（无昵称）'}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-[#a89a8e]">
                    @{person.username ?? '—'} · {person.id.slice(0, 8)}
                  </span>
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {[
                  { days: 7, label: '停用 7 天' },
                  { days: 30, label: '停用 30 天' },
                  { days: 36500, label: '永久' },
                ].map((option) => (
                  <button
                    key={option.days}
                    type="button"
                    disabled={busy === person.id}
                    onClick={() => void setBan(person, option.days)}
                    className="rounded-lg border border-[#f0e6dc] px-2.5 py-1 text-[11px] text-[#8a7a9a] transition hover:border-[#e0a184] hover:text-[#c96447] disabled:opacity-50"
                  >
                    {option.label}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={busy === person.id}
                  onClick={() => void setBan(person, 0)}
                  className="flex items-center gap-1 rounded-lg border border-[#f0e6dc] px-2.5 py-1 text-[11px] text-[#8a7a9a] transition hover:text-[#3a3229] disabled:opacity-50"
                >
                  <Icon name="check" className="h-3 w-3" />
                  解除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hint && <p className="mt-3 whitespace-pre-line text-[11px] text-[#8a7a9a]">{hint}</p>}
    </section>
  )
}
