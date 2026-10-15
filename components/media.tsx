'use client'

import { useState } from 'react'
import { createClient } from '../app/lib/supabase'

/**
 * 图片：上传 + 展示
 *
 * 桶：media（公开读；登录用户只能写自己 uid 的目录）
 * 见项目根目录 supabase-media-bucket.sql
 *
 * 存法：friend_posts.image_urls 是 text[]，直接存公开 URL。
 */

const supabase = createClient()

export const MEDIA_BUCKET = 'media'
export const MAX_IMAGES = 9
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export type UploadResult = { url?: string; error?: string }

/** 上传单张图片，返回公开 URL */
export async function uploadImage(file: File, userId: string): Promise<UploadResult> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: '只支持 JPG / PNG / WebP / GIF' }
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: `图片不能超过 ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB` }
  }

  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) {
    console.error('上传图片失败:', error)
    // 常见原因：桶没建 / 没配策略
    return { error: error.message || '上传失败（可能还没建 media 桶）' }
  }

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path)
  return { url: data.publicUrl }
}

/* ==================== 展示 ==================== */

/** 只读图片墙：1 张时大图，多张时九宫格 */
export function ImageGrid({
  urls,
  className = '',
  onRemove,
}: {
  urls: string[] | null | undefined
  className?: string
  /** 传了就在每张右上角显示删除（发布前预览用） */
  onRemove?: (url: string) => void
}) {
  const list = (urls ?? []).filter(Boolean)
  if (list.length === 0) return null

  const single = list.length === 1

  return (
    <div
      className={`grid gap-2 ${single ? 'grid-cols-1' : 'grid-cols-3'} ${className}`}
    >
      {list.map((url) => (
        <div key={url} className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            className={`w-full rounded-xl border border-[#f0e4d4] object-cover ${
              single ? 'max-h-80' : 'h-24'
            }`}
          />
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(url)}
              aria-label="移除这张图"
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-[11px] leading-none text-white hover:bg-black/75 transition"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

/** 发布区里的图片选择器：本地上传 + 粘贴链接 */
export function ImagePicker({
  userId,
  urls,
  onChange,
  disabled,
}: {
  userId: string | null
  urls: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}) {
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [linkInput, setLinkInput] = useState('')

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !userId) return
    setMessage('')

    const room = MAX_IMAGES - urls.length
    if (room <= 0) {
      setMessage(`最多 ${MAX_IMAGES} 张`)
      return
    }

    const picked = Array.from(files).slice(0, room)
    setUploading(true)
    try {
      const next: string[] = []
      for (const file of picked) {
        const result = await uploadImage(file, userId)
        if (result.error) {
          setMessage(result.error)
          break
        }
        if (result.url) next.push(result.url)
      }
      if (next.length > 0) onChange([...urls, ...next])
    } finally {
      setUploading(false)
    }
  }

  function addLink() {
    const url = linkInput.trim()
    if (!url) return
    if (!/^https?:\/\//i.test(url)) {
      setMessage('链接要以 http(s):// 开头')
      return
    }
    if (urls.length >= MAX_IMAGES) {
      setMessage(`最多 ${MAX_IMAGES} 张`)
      return
    }
    onChange([...urls, url])
    setLinkInput('')
    setMessage('')
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <label
          className={`cursor-pointer rounded-xl border border-[#ece6dd] bg-white px-3 py-1.5 text-xs text-[#8a827a] transition hover:border-[#e0a184] ${
            disabled || uploading ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          {uploading ? '上传中…' : '＋ 图片'}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={disabled || uploading}
            onChange={(e) => {
              void handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </label>

        <span className="text-[10px] text-[#c0b8ae]">
          {urls.length}/{MAX_IMAGES}
        </span>

        <div className="flex min-w-[200px] flex-1 items-center gap-2">
          <input
            type="text"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addLink()
              }
            }}
            placeholder="也可以粘贴图片链接"
            className="min-w-0 flex-1 rounded-xl border border-[#ece6dd] bg-[#fefcf9] px-3 py-1.5 text-xs text-[#2b2620] focus:outline-none focus:border-[#d97757] transition"
          />
          <button
            type="button"
            onClick={addLink}
            disabled={disabled || !linkInput.trim()}
            className="rounded-xl border border-[#ece6dd] bg-white px-2.5 py-1.5 text-xs text-[#8a827a] transition hover:border-[#e0a184] disabled:opacity-50"
          >
            添加
          </button>
        </div>
      </div>

      {message && <p className="mt-2 text-[11px] text-red-500">{message}</p>}

      <ImageGrid
        urls={urls}
        className="mt-3"
        onRemove={(url) => onChange(urls.filter((u) => u !== url))}
      />
    </div>
  )
}
