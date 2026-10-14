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
      if (!userData.user) {
        router.push('/login')
        return
      }
      setUserId(userData.user.id)

      const { data } = await supabase
        .from('profiles')
        .select('nickname, signature, location, birthday, avatar_url')
        .eq('id', userData.user.id)
        .single()

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

    const { error } = await supabase
      .from('profiles')
      .update({
        nickname: nickname.trim() || null,
        signature: signature.trim() || null,
        location: location.trim() || null,
        birthday: birthday || null,
        avatar_url: avatarUrl.trim() || null,
      })
      .eq('id', userId)

    if (error) {
      setMessage('保存失败：' + error.message)
    } else {
      setMessage('已保存！')
      setTimeout(() => router.push('/me'), 1000)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6">
      <header className="max-w-2xl mx-auto mb-6">
        <Link href="/me" className="text-sm text-gray-500 hover:underline">
          ← 返回
        </Link>
        <h1 className="text-3xl font-bold mt-2">编辑资料</h1>
      </header>

      <form onSubmit={handleSave} className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow space-y-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">昵称</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="给自己起个名字"
            maxLength={20}
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">签名</label>
          <input
            type="text"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="一句话介绍自己"
            maxLength={50}
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">所在地</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="比如：北京"
            maxLength={30}
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">生日</label>
          <input
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">头像图片链接</label>
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://... （暂时先支持粘贴图片链接）"
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
          <p className="text-xs text-gray-400 mt-1">
            暂时先支持粘贴图片链接，以后会做成上传。
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-orange-500 text-white p-2 rounded hover:bg-orange-600 disabled:bg-gray-300"
        >
          {saving ? '保存中...' : '保存'}
        </button>

        {message && (
          <p className={`text-sm text-center ${message.includes('失败') ? 'text-red-500' : 'text-green-600'}`}>
            {message}
          </p>
        )}
      </form>
    </div>
  )
}