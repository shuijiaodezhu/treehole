'use client'
/* eslint-disable @next/next/no-img-element -- 头像/背景图预览用原生 img 即可 */

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { uploadImage } from '../../../components/media'

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
  const [coverUrl, setCoverUrl] = useState('')
  const [uploadingCover, setUploadingCover] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  /** 上传一张背景图（复用 media 桶） */
  async function handleCoverFile(files: FileList | null) {
    const file = files?.[0]
    if (!file || !userId) return
    setMessage('')
    setUploadingCover(true)
    try {
      const result = await uploadImage(file, userId)
      if (result.error || !result.url) {
        setMessage('上传失败：' + (result.error ?? '未知错误'))
        return
      }
      setCoverUrl(result.url)
    } finally {
      setUploadingCover(false)
    }
  }

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) { router.push('/login'); return }
      setUserId(userData.user.id)
      const { data } = await supabase.from('profiles').select('nickname, signature, location, birthday, avatar_url, cover_url').eq('id', userData.user.id).single()
      if (data) {
        setNickname(data.nickname || '')
        setSignature(data.signature || '')
        setLocation(data.location || '')
        setBirthday(data.birthday || '')
        setAvatarUrl(data.avatar_url || '')
        setCoverUrl(data.cover_url || '')
      }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      cover_url: coverUrl.trim() || null,
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
              <p className="text-[10px] text-[#b8a8c8] mt-1.5">可以粘贴链接，也可以直接上传。</p>
              <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#e0d4e8] bg-white px-3 py-1.5 text-xs text-[#7a5a9a] transition hover:bg-[#faf5ff]">
                {uploadingCover ? '上传中…' : '＋ 上传头像'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingCover}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file || !userId) return
                    setUploadingCover(true)
                    const result = await uploadImage(file, userId)
                    setUploadingCover(false)
                    if (result.url) { setAvatarUrl(result.url); setMessage('') }
                    else setMessage('上传失败：' + (result.error ?? '未知错误'))
                  }}
                />
              </label>
            </div>

            {/* 主页背景图 */}
            <div>
              <label className="block text-xs text-[#8a7a9a] mb-1.5 tracking-wide">主页背景图</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="图片链接，或点右侧上传"
                  className="min-w-0 flex-1 px-4 py-2.5 rounded-xl border border-[#e0d4e8] bg-[#fcf8ff] text-sm text-[#2b2430] focus:outline-none focus:border-[#a88ab8] focus:ring-2 focus:ring-[#a88ab8]/10 transition"
                />
                <label className="flex flex-shrink-0 cursor-pointer items-center rounded-xl border border-[#e0d4e8] bg-white px-3 text-xs text-[#7a5a9a] transition hover:bg-[#faf5ff]">
                  {uploadingCover ? '上传中…' : '上传'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingCover}
                    onChange={(e) => {
                      void handleCoverFile(e.target.files)
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>
              <p className="text-[10px] text-[#b8a8c8] mt-1.5">会铺在「我的」页面顶部，建议横向图片。</p>

              {coverUrl && (
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-20 flex-1 overflow-hidden rounded-xl border border-[#e0d4e8] bg-[#f6f0fa]">
                    <img src={coverUrl} alt="背景预览" className="h-full w-full object-cover" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setCoverUrl('')}
                    className="flex-shrink-0 rounded-xl border border-[#e0d4e8] px-3 py-1.5 text-xs text-[#9a8aaa] transition hover:text-red-500"
                  >
                    移除
                  </button>
                </div>
              )}
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