'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../lib/supabase'
import { Icon } from '../../../components/icons'
import { useBlocks } from '../../../components/blocks'
import { useFriendGroups, useFriendList } from '../../../components/visibility'

// 单例放模块级，保证引用稳定
const supabase = createClient()

type SearchHit = {
  id: string
  username: string | null
  nickname: string | null
  avatar_url: string | null
}

/** 密码强度校验（与原来一致） */
function validatePassword(pw: string): string | null {
  if (pw.length < 8) return '密码至少 8 位'
  if (!/[a-zA-Z]/.test(pw)) return '密码必须包含字母'
  if (!/[0-9]/.test(pw)) return '密码必须包含数字'
  if (/^(.)\1+$/.test(pw)) return '密码不能是重复字符'
  const weakList = ['password', '12345678', 'qwertyui', 'abcd1234']
  if (weakList.includes(pw.toLowerCase())) return '这个密码太常见了，换一个'
  return null
}

export default function SettingsPage() {
  const [meId, setMeId] = useState<string | null>(null)

  /* ---------- 修改密码：两步点击 ---------- */
  const [pwStep, setPwStep] = useState<'idle' | 'editing' | 'confirm'>('idle')
  const [password, setPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMessage, setPwMessage] = useState('')

  /* ---------- 拉黑管理 ---------- */
  const blocks = useBlocks(meId)
  const [keyword, setKeyword] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchMessage, setSearchMessage] = useState('')
  const [searchHit, setSearchHit] = useState<SearchHit | null>(null)
  const [actionMessage, setActionMessage] = useState('')

  /* ---------- 好友分组（朋友圈"指定分组可见"用） ---------- */
  const friendList = useFriendList(meId)
  const groupApi = useFriendGroups(meId)
  const [newGroupName, setNewGroupName] = useState('')
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [groupMessage, setGroupMessage] = useState('')

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault()
    setGroupMessage('')
    const result = await groupApi.createGroup(newGroupName)
    if (!result.ok) {
      setGroupMessage('创建失败：' + (result.message ?? '未知错误'))
      return
    }
    setNewGroupName('')
    setGroupMessage('分组已创建')
  }

  async function handleToggleMember(groupId: string, memberId: string, checked: boolean) {
    const group = groupApi.groups.find((g) => g.id === groupId)
    if (!group) return
    const next = checked
      ? [...group.memberIds, memberId]
      : group.memberIds.filter((id) => id !== memberId)
    const result = await groupApi.setMembers(groupId, next)
    if (!result.ok) setGroupMessage('保存失败：' + (result.message ?? '未知错误'))
  }

  async function handleDeleteGroup(groupId: string, name: string) {
    if (!confirm(`删除分组「${name}」？（已发过的动态不受影响）`)) return
    const result = await groupApi.deleteGroup(groupId)
    if (!result.ok) setGroupMessage('删除失败：' + (result.message ?? '未知错误'))
    else if (expandedGroup === groupId) setExpandedGroup(null)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data, error } = await supabase.auth.getUser()
        if (error) throw error
        if (!cancelled) setMeId(data.user?.id ?? null)
      } catch (err) {
        console.error('设置页读取用户失败:', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /* ---------- 密码第一步：校验后进入确认 ---------- */
  function handlePasswordNext(e: React.FormEvent) {
    e.preventDefault()
    setPwMessage('')
    const problem = validatePassword(password)
    if (problem) {
      setPwMessage(problem)
      return
    }
    setPwStep('confirm')
  }

  /* ---------- 密码第二步：真正提交 ---------- */
  async function handlePasswordConfirm() {
    setPwLoading(true)
    setPwMessage('')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setPwMessage('密码已更新')
      setPassword('')
      setPwStep('idle')
    } catch (err) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : String(err)
      setPwMessage('修改失败：' + msg)
      setPwStep('editing')
    } finally {
      setPwLoading(false)
    }
  }

  /* ---------- 找人并拉黑 ---------- */
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = keyword.trim()
    if (!q) return
    setSearching(true)
    setSearchMessage('')
    setSearchHit(null)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, nickname, avatar_url')
        .or(`username.eq.${q},nickname.eq.${q}`)
        .limit(1)
      if (error) throw error

      const hit = (data ?? [])[0] ?? null
      if (!hit) {
        setSearchMessage('没找到这个人（要输入完整的用户名或昵称）')
      } else if (hit.id === meId) {
        setSearchMessage('这是你自己')
      } else {
        setSearchHit(hit as SearchHit)
      }
    } catch (err) {
      console.error('查找用户失败:', err)
      setSearchMessage('查找失败，稍后再试')
    } finally {
      setSearching(false)
    }
  }

  async function handleBlock(userId: string) {
    setActionMessage('')
    const result = await blocks.block(userId)
    if (!result.ok) {
      setActionMessage('拉黑失败：' + (result.message ?? '未知错误'))
      return
    }
    setSearchHit(null)
    setKeyword('')
    setActionMessage('已拉黑。你们互相看不到对方的内容了。')
  }

  async function handleUnblock(userId: string) {
    setActionMessage('')
    const result = await blocks.unblock(userId)
    if (!result.ok) setActionMessage('解除失败：' + (result.message ?? '未知错误'))
    else setActionMessage('已解除拉黑')
  }

  const pwIsError =
    pwMessage.includes('失败') ||
    pwMessage.includes('必须') ||
    pwMessage.includes('至少') ||
    pwMessage.includes('不能') ||
    pwMessage.includes('常见')

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute -top-20 -right-20 w-96 h-96 bg-[#c8b8d8] opacity-20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-[#a88ab8] opacity-10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative max-w-xl mx-auto px-6 py-10">
        <header className="mb-6">
          <Link href="/me" className="text-sm text-[#8a7a9a] hover:text-[#8a7aaa] transition">
            ← 返回
          </Link>
          <h1 className="text-3xl font-bold text-[#2b2430] mt-2">设置</h1>
          <p className="text-sm text-[#8a7a9a] mt-1">账号和安全</p>
        </header>

        <main className="space-y-4">
          {/* ==================== 修改密码（两步点击） ==================== */}
          <section className="rounded-3xl border border-[#e0d4e8] bg-white/80 backdrop-blur-lg p-6 shadow-[0_8px_40px_rgba(168,138,184,0.06)] relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-[#c8b8d8] opacity-[0.12] rounded-full blur-2xl pointer-events-none"></div>

            <div className="relative">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-full bg-[#f0e6f8] flex items-center justify-center">
                  <Icon name="lock" className="w-4 h-4 text-[#8a7aaa]" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[#2b2430]">修改密码</h2>
                  <p className="text-[10px] text-[#b8a8c8] mt-0.5">至少 8 位，含字母和数字</p>
                </div>
              </div>

              {pwStep === 'idle' && (
                <button
                  type="button"
                  onClick={() => {
                    setPwStep('editing')
                    setPwMessage('')
                  }}
                  className="w-full py-2.5 rounded-xl border border-[#d8c8e4] bg-[#fcf8ff] text-sm text-[#7a5a9a] font-medium hover:bg-[#f6eefc] transition"
                >
                  重设密码
                </button>
              )}

              {pwStep === 'editing' && (
                <form onSubmit={handlePasswordNext}>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="输入新密码"
                    minLength={8}
                    required
                    autoFocus
                    className="w-full px-4 py-2.5 rounded-xl border border-[#e0d4e8] bg-[#fcf8ff] text-sm text-[#2b2430] focus:outline-none focus:border-[#a88ab8] focus:ring-2 focus:ring-[#a88ab8]/10 transition mb-4"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPwStep('idle')
                        setPassword('')
                        setPwMessage('')
                      }}
                      className="flex-1 py-2.5 rounded-xl border border-[#e0d4e8] text-sm text-[#8a7a9a] hover:bg-[#faf5ff] transition"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#b89ac8] to-[#a88ab8] text-white text-sm font-medium hover:shadow-[0_6px_20px_rgba(168,138,184,0.3)] transition-all"
                    >
                      下一步
                    </button>
                  </div>
                </form>
              )}

              {pwStep === 'confirm' && (
                <div className="rounded-2xl border border-[#e0d4e8] bg-[#fcf8ff] p-4">
                  <p className="text-xs text-[#5a4a6a] leading-relaxed">
                    确认把密码改成这个吗？改完要记牢，忘了就得走邮箱找回。
                  </p>
                  <div className="flex gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => setPwStep('editing')}
                      className="flex-1 py-2.5 rounded-xl border border-[#e0d4e8] text-sm text-[#8a7a9a] hover:bg-white transition"
                    >
                      返回改一下
                    </button>
                    <button
                      type="button"
                      disabled={pwLoading}
                      onClick={() => void handlePasswordConfirm()}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#b89ac8] to-[#a88ab8] text-white text-sm font-medium hover:shadow-[0_6px_20px_rgba(168,138,184,0.3)] transition-all disabled:opacity-60"
                    >
                      {pwLoading ? '保存中…' : '确认修改'}
                    </button>
                  </div>
                </div>
              )}

              {pwMessage && (
                <p className={`text-xs text-center mt-3 ${pwIsError ? 'text-red-500' : 'text-green-600'}`}>
                  {pwMessage}
                </p>
              )}
            </div>
          </section>

          {/* ==================== 拉黑 / 屏蔽 ==================== */}
          <section className="rounded-3xl border border-[#e0d4e8] bg-white/80 backdrop-blur-lg p-6 shadow-[0_8px_40px_rgba(168,138,184,0.06)]">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-full bg-[#f0e6f8] flex items-center justify-center">
                <Icon name="shield" className="w-4 h-4 text-[#8a7aaa]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#2b2430]">拉黑与屏蔽</h2>
                <p className="text-[10px] text-[#b8a8c8] mt-0.5">
                  互相看不到对方的帖子、评论、朋友圈和活动
                </p>
              </div>
            </div>

            {/* 找人拉黑 */}
            <form onSubmit={handleSearch} className="flex gap-2 mb-4">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="输入完整用户名或昵称"
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#e0d4e8] bg-[#fcf8ff] text-sm text-[#2b2430] focus:outline-none focus:border-[#a88ab8] focus:ring-2 focus:ring-[#a88ab8]/10 transition"
              />
              <button
                type="submit"
                disabled={searching || !keyword.trim()}
                className="px-4 py-2.5 rounded-xl bg-[#a88ab8] text-white text-sm hover:bg-[#9a7aa8] transition disabled:opacity-50"
              >
                {searching ? '找…' : '查找'}
              </button>
            </form>

            {searchMessage && <p className="text-xs text-[#b8a8c8] mb-3">{searchMessage}</p>}

            {searchHit && (
              <div className="flex items-center gap-3 rounded-2xl border border-[#e0d4e8] bg-[#fcf8ff] p-3 mb-4">
                <span className="w-9 h-9 rounded-full bg-[#f0e6f8] flex items-center justify-center overflow-hidden flex-shrink-0 text-xs text-[#7a5a9a] font-semibold">
                  {searchHit.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={searchHit.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (searchHit.nickname || searchHit.username || '某').slice(0, 1)
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#2b2430] truncate">
                    {searchHit.nickname || searchHit.username}
                  </p>
                  {searchHit.username && (
                    <p className="text-[10px] text-[#b8a8c8] truncate">@{searchHit.username}</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={blocks.busyId === searchHit.id}
                  onClick={() => void handleBlock(searchHit.id)}
                  className="flex-shrink-0 rounded-full bg-red-500 px-3 py-1 text-[11px] text-white hover:bg-red-600 transition disabled:opacity-50"
                >
                  {blocks.busyId === searchHit.id ? '处理中…' : '拉黑'}
                </button>
              </div>
            )}

            {/* 已拉黑列表 */}
            <div className="border-t border-[#f0e6f8] pt-4">
              <p className="text-[10px] text-[#b8a8c8] tracking-wide mb-2">
                已拉黑 · {blocks.blockedUsers.length}
              </p>

              {blocks.error && <p className="text-xs text-red-500 mb-2">{blocks.error}</p>}
              {blocks.loading && blocks.blockedUsers.length === 0 && (
                <p className="text-xs text-[#b8a8c8]">加载中…</p>
              )}
              {!blocks.loading && blocks.blockedUsers.length === 0 && !blocks.error && (
                <p className="text-xs text-[#b8a8c8]">还没有拉黑任何人</p>
              )}

              <div className="space-y-2">
                {blocks.blockedUsers.map((b) => (
                  <div key={b.id} className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-[#f0e6f8] flex items-center justify-center overflow-hidden flex-shrink-0 text-[11px] text-[#7a5a9a] font-semibold">
                      {b.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (b.nickname || b.username || '某').slice(0, 1)
                      )}
                    </span>
                    <span className="flex-1 min-w-0 text-sm text-[#2b2430] truncate">
                      {b.nickname || b.username || '某位用户'}
                    </span>
                    <button
                      type="button"
                      disabled={blocks.busyId === b.user_id}
                      onClick={() => void handleUnblock(b.user_id)}
                      className="flex-shrink-0 rounded-full border border-[#e0d4e8] px-3 py-1 text-[11px] text-[#8a7a9a] hover:bg-[#faf5ff] transition disabled:opacity-50"
                    >
                      {blocks.busyId === b.user_id ? '处理中…' : '解除'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {actionMessage && (
              <p className="text-xs text-center mt-4 text-[#7a5a9a]">{actionMessage}</p>
            )}
          </section>

          {/* ==================== 好友分组 ==================== */}
          <section className="rounded-3xl border border-[#e0d4e8] bg-white/80 backdrop-blur-lg p-6 shadow-[0_8px_40px_rgba(168,138,184,0.06)]">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-full bg-[#f0e6f8] flex items-center justify-center">
                <Icon name="users" className="w-4 h-4 text-[#8a7aaa]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#2b2430]">好友分组</h2>
                <p className="text-[10px] text-[#b8a8c8] mt-0.5">
                  发朋友圈时可以选「指定分组可见」
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateGroup} className="flex gap-2 mb-4">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="新分组名，比如：家人 / 同事"
                maxLength={20}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#e0d4e8] bg-[#fcf8ff] text-sm text-[#2b2430] focus:outline-none focus:border-[#a88ab8] focus:ring-2 focus:ring-[#a88ab8]/10 transition"
              />
              <button
                type="submit"
                disabled={groupApi.busy || !newGroupName.trim()}
                className="px-4 py-2.5 rounded-xl bg-[#a88ab8] text-white text-sm hover:bg-[#9a7aa8] transition disabled:opacity-50"
              >
                新建
              </button>
            </form>

            {groupApi.error && <p className="text-xs text-red-500 mb-3">{groupApi.error}</p>}
            {groupApi.loading && groupApi.groups.length === 0 && (
              <p className="text-xs text-[#b8a8c8]">加载中…</p>
            )}
            {!groupApi.loading && groupApi.groups.length === 0 && !groupApi.error && (
              <p className="text-xs text-[#b8a8c8]">还没有分组</p>
            )}

            <div className="space-y-2">
              {groupApi.groups.map((g) => {
                const open = expandedGroup === g.id
                return (
                  <div key={g.id} className="rounded-2xl border border-[#f0e6f8] bg-[#fcf8ff] p-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedGroup(open ? null : g.id)}
                        className="flex flex-1 items-center gap-2 text-left"
                      >
                        <Icon name={open ? 'check' : 'users'} className="w-3.5 h-3.5 text-[#8a7aaa]" />
                        <span className="text-sm text-[#2b2430]">{g.name}</span>
                        <span className="text-[10px] text-[#b8a8c8]">{g.memberIds.length} 人</span>
                        <span className="ml-auto text-[10px] text-[#b8a8c8]">
                          {open ? '收起' : '编辑成员'}
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={groupApi.busy}
                        onClick={() => void handleDeleteGroup(g.id, g.name)}
                        className="text-[10px] text-[#b8a8c8] hover:text-red-500 transition disabled:opacity-50"
                      >
                        删除
                      </button>
                    </div>

                    {open && (
                      <div className="mt-3 max-h-48 overflow-y-auto border-t border-[#f0e6f8] pt-2">
                        {friendList.friends.length === 0 ? (
                          <p className="text-[11px] text-[#b8a8c8]">还没有好友</p>
                        ) : (
                          friendList.friends.map((f) => (
                            <label
                              key={f.id}
                              className="flex cursor-pointer items-center gap-2 py-1 text-xs text-[#5a4a6a]"
                            >
                              <input
                                type="checkbox"
                                checked={g.memberIds.includes(f.id)}
                                disabled={groupApi.busy}
                                onChange={(e) => void handleToggleMember(g.id, f.id, e.target.checked)}
                                className="accent-[#a88ab8]"
                              />
                              <span className="truncate">{f.name}</span>
                            </label>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {groupMessage && <p className="text-xs text-center mt-4 text-[#7a5a9a]">{groupMessage}</p>}
          </section>

          <div className="rounded-2xl border border-[#e0d4e8] bg-gradient-to-br from-[#f8f2fc] to-[#f0e6f8] p-5 relative overflow-hidden">
            <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-[#a88ab8] opacity-[0.07] rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute top-2 right-4 text-[#d8c8e0] font-art text-5xl leading-none select-none pointer-events-none">
              &ldquo;
            </div>

            <div className="relative">
              <p className="text-[10px] text-[#b8a8c8] tracking-wider mb-3">关于密码</p>
              <p className="text-sm text-[#5a4a6a] leading-loose font-serif-cn">试试用一个你记得住的名字。</p>
              <p className="text-sm text-[#5a4a6a] leading-loose font-serif-cn mt-1">忘不掉的那种。</p>
              <p className="text-sm text-[#5a4a6a] leading-loose font-serif-cn mt-1">如果有一天忘了，也许还能想起 Ta。</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
