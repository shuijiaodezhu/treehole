'use client'
/* eslint-disable @next/next/no-img-element -- 头像/背景图预览用原生 img 即可 */

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { uploadImage } from '../../../components/media'
import { pageAccentVars } from '../../../components/theme'
import { SkeletonCard } from '../../../components/skeleton'

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
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  /** 上传头像（复用 media 桶） */
  async function handleAvatarFile(files: FileList | null) {
    const file = files?.[0]
    if (!file || !userId) return
    setMessage('')
    setUploadingAvatar(true)
    try {
      const result = await uploadImage(file, userId)
      if (result.error || !result.url) {
        setMessage('上传失败：' + (result.error ?? '未知错误'))
        return
      }
      setAvatarUrl(result.url)
    } finally {
      setUploadingAvatar(false)
    }
  }

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) { router.push('/login'); return }
      setUserId(userData.user.id)
      // 用 * 而不是逐个列名：少一列也不会让整条查询失败
      const { data } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single()
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
    }).eq('id', userId)
    if (error) { setMessage('保存失败：' + error.message) }
    else {
      setMessage('已保存！')
      setTimeout(() => router.push('/me'), 1000)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-6 pt-24">
        <SkeletonCard lines={3} />
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={pageAccentVars('me')}>

      <div className="relative max-w-xl mx-auto px-6 py-10">
        <header className="mb-6">
          <Link href="/me" className="text-sm text-base-content/60 hover:text-primary transition">← 返回</Link>
          <h1 className="text-3xl font-bold text-base-content mt-2">编辑资料</h1>
          <p className="text-sm text-base-content/60 mt-1">让别人多认识你一点</p>
        </header>

        <form onSubmit={handleSave} className="card rounded-box border border-base-300 bg-base-100 p-6 shadow-sm space-y-5 relative overflow-hidden">

          <div className="relative space-y-5">
            <div>
              <label className="block text-xs text-base-content/60 mb-1.5 tracking-wide">昵称</label>
              <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="给自己起个名字" maxLength={20} className="w-full px-4 py-2.5 rounded-box border border-base-300 bg-primary/5 text-sm text-base-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition" />
            </div>

            <div>
              <label className="block text-xs text-base-content/60 mb-1.5 tracking-wide">签名</label>
              <input type="text" value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="一句话介绍自己" maxLength={50} className="w-full px-4 py-2.5 rounded-box border border-base-300 bg-primary/5 text-sm text-base-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition" />
            </div>

            <div>
              <label className="block text-xs text-base-content/60 mb-1.5 tracking-wide">所在地</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="比如：徐州" maxLength={30} className="w-full px-4 py-2.5 rounded-box border border-base-300 bg-primary/5 text-sm text-base-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition" />
            </div>

            <div>
              <label className="block text-xs text-base-content/60 mb-1.5 tracking-wide">生日</label>
              <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className="w-full px-4 py-2.5 rounded-box border border-base-300 bg-primary/5 text-sm text-base-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition" />
            </div>

            <div>
              <label className="block text-xs text-base-content/60 mb-1.5 tracking-wide">头像图片链接</label>
              <input type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." className="w-full px-4 py-2.5 rounded-box border border-base-300 bg-primary/5 text-sm text-base-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition" />
              <p className="text-[11px] text-accent mt-1.5">可以粘贴链接，也可以直接上传。</p>
              <label className="card mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-box border border-base-300 bg-base-100 px-3 py-1.5 text-xs text-primary transition hover:bg-primary/5">
                {uploadingAvatar ? '上传中…' : '＋ 上传头像'}
                <input
                  type="file"
                  accept="image/*"
                  className="input hidden"
                  disabled={uploadingAvatar}
                  onChange={(e) => {
                    void handleAvatarFile(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>

            {avatarUrl && (
              <div className="flex items-center gap-3 pt-2 border-t border-base-300">
                <div className="w-12 h-12 rounded-box overflow-hidden bg-base-300">
                  <img src={avatarUrl} alt="预览" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                </div>
                <p className="text-xs text-base-content/60">头像预览</p>
              </div>
            )}

            <button type="submit" disabled={saving} className="btn btn-primary w-full hover:shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed">
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