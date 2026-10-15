'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function EditProfilePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [nickname, setNickname] = useState('')
  const [signature, setSignature] = useState('')
  const [location, setLocation] = useState('')
  const [birthday, setBirthday] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) { router.push('/login'); return }
      setUserId(userData.user.id)
      const { data } = await supabase.from('profiles').select('nickname, signature, location, birthday, avatar_url').eq('id', userData.user.id).single()
      if (data) {
        setNickname(data.nickname || '')
        setSignature(data.signature || '')
        setLocation(data.location || '')
        setBirthday(data.birthday || '')
        setAvatarUrl(data.avatar_url || '')
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    setSaving(true)
    setMessage('')
    const { error } = await supabase.from('profiles').update({
      nickname: nickname.trim() || null,
      signature: signature.trim() || null,
      location: location.trim() || null,
      birthday: birthday || null,
      avatar_url: avatarUrl.trim() || null,
    }).eq('id', userId)
    if (error) { setMessage('保存失败：' + error.message) }
    else {
      setMessage('已保存！')
      setTimeout(() => router.push('/me'), 1000)
    }
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p>加载中...</p></div>

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute -top-20 -right-20 w-96 h-96 bg-[#c8b8d8] opacity-20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-[#a88ab8] opacity-10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative max-w-xl mx-auto px-6 py-10">
        <header className="mb-6">
          <Link href="/me" className="text-sm text-[#8a7a9a] hover:text-[#8a7aaa] transition">← 返回</Link>
          <h1 className="text-3xl font-bold text-[#2b2430] mt-2">编辑资料</h1>
          <p className="text-sm text-[#8a7a9a] mt-1">让别人多认识你一点</p>
        </header>

        <form onSubmit={handleSave} className="rounded-3xl border border-[#e0d4e8] bg-white/80 backdrop-blur-lg p-6 shadow-[0_8px_40px_rgba(168,138,184,0.06)] space-y-5 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-[#c8b8d8] opacity-[0.12] rounded-full blur-2xl pointer-events-none"></div>

          <div className="relative space-y-5">
            <div>
              <label className="block text-xs text-[#8a7a9a] mb-1.5 tracking-wide">昵称</label>
              <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="给自己起个名字" maxLength={20} className="w-full px-4 py-2.5 rounded-xl border border-[#e0d4e8] bg-[#fcf8ff] text-sm text-[#2b2430] focus:outline-none focus:border-[#a88ab8] focus:ring-2 focus:ring-[#a88ab8]/10 transition" />
            </div>

            <div>
              <label className="block text-xs text-[#8a7a9a] mb-1.5 tracking-wide">签名</label>
              <input type="text" value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="一句话介绍自己" maxLength={50} className="w-full px-4 py-2.5 rounded-xl border border-[#e0d4e8] bg-[#fcf8ff] text-sm text-[#2b2430] focus:outline-none focus:border-[#a88ab8] focus:ring-2 focus:ring-[#a88ab8]/10 transition" />
            </div>

            <div>
              <label className="block text-xs text-[#8a7a9a] mb-1.5 tracking-wide">所在地</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="比如：徐州" maxLength={30} className="w-full px-4 py-2.5 rounded-xl border border-[#e0d4e8] bg-[#fcf8ff] text-sm text-[#2b2430] focus:outline-none focus:border-[#a88ab8] focus:ring-2 focus:ring-[#a88ab8]/10 transition" />
            </div>

            <div>
              <label className="block text-xs text-[#8a7a9a] mb-1.5 tracking-wide">生日</label>
              <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-[#e0d4e8] bg-[#fcf8ff] text-sm text-[#2b2430] focus:outline-none focus:border-[#a88ab8] focus:ring-2 focus:ring-[#a88ab8]/10 transition" />
            </div>

            <div>
              <label className="block text-xs text-[#8a7a9a] mb-1.5 tracking-wide">头像图片链接</label>
              <input type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." className="w-full px-4 py-2.5 rounded-xl border border-[#e0d4e8] bg-[#fcf8ff] text-sm text-[#2b2430] focus:outline-none focus:border-[#a88ab8] focus:ring-2 focus:ring-[#a88ab8]/10 transition" />
              <p className="text-[10px] text-[#b8a8c8] mt-1.5">暂时先支持粘贴图片链接，以后会做成上传。</p>
            </div>

            {avatarUrl && (
              <div className="flex items-center gap-3 pt-2 border-t border-[#e0d4e8]">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#e0d4e8]">
                  <img src={avatarUrl} alt="预览" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                </div>
                <p className="text-xs text-[#9a8aaa]">头像预览</p>
              </div>
            )}

            <button type="submit" disabled={saving} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#b89ac8] to-[#a88ab8] text-white text-sm font-medium hover:shadow-[0_6px_20px_rgba(168,138,184,0.3)] transition-all disabled:opacity-60 disabled:cursor-not-allowed">
              {saving ? '保存中...' : '保 存'}
            </button>

            {message && (
              <p className={`text-xs text-center ${message.includes('失败') ? 'text-red-500' : 'text-green-600'}`}>{message}</p>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}