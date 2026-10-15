'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '../app/lib/supabase'

/**
 * 储物箱：号主私有文件存储
 *
 *   桶   vault（private，只能通过签名链接访问）
 *   表   user_files（文件名/路径/大小/类型/分类）
 *   限制 单个文件 ≤ 10MB；只能读写自己 uid 目录
 *
 * 依赖 supabase-vault.sql
 */

const supabase = createClient()

export const VAULT_BUCKET = 'vault'
export const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10MB

export type FileCategory = 'image' | 'video' | 'audio' | 'doc' | 'archive' | 'other'

export const CATEGORY_LABEL: Record<FileCategory, string> = {
  image: '图片',
  video: '视频',
  audio: '音频',
  doc: '文档',
  archive: '压缩包',
  other: '其他',
}

export const CATEGORY_ORDER: FileCategory[] = ['image', 'video', 'audio', 'doc', 'archive', 'other']

export type VaultFile = {
  id: string
  name: string
  path: string
  size: number
  mime: string | null
  category: FileCategory
  created_at: string
}

function errText(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message
    if (typeof m === 'string') return m
  }
  return String(err)
}

/** 按 MIME 与扩展名判断分类 */
export function detectCategory(file: { type?: string; name: string }): FileCategory {
  const mime = (file.type ?? '').toLowerCase()
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'

  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'heic'].includes(ext)) return 'image'
  if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return 'audio'
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'json'].includes(ext)) return 'doc'
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return 'archive'
  return 'other'
}

/** 人性化体积 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export type UploadOutcome = { ok: boolean; message?: string; file?: VaultFile }

export function useVault(userId: string | null) {
  const [files, setFiles] = useState<VaultFile[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!userId) {
      const frame = window.requestAnimationFrame(() => setFiles([]))
      return () => window.cancelAnimationFrame(frame)
    }

    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const { data, error: queryError } = await supabase
          .from('user_files')
          .select('id, name, path, size, mime, category, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (queryError) throw queryError
        if (!cancelled) {
          setFiles((data ?? []) as unknown as VaultFile[])
          setError('')
        }
      } catch (err) {
        console.error('加载储物箱失败:', err)
        if (!cancelled) setError('储物箱加载失败（可能还没跑 supabase-vault.sql）')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId, reloadKey])

  const refresh = useCallback(() => setReloadKey((k) => k + 1), [])

  /** 上传一个文件（≤10MB），成功后登记元数据 */
  const upload = useCallback(
    async (file: File): Promise<UploadOutcome> => {
      if (!userId) return { ok: false, message: '请先登录' }
      if (file.size > MAX_FILE_BYTES) {
        return { ok: false, message: `文件不能超过 ${MAX_FILE_BYTES / 1024 / 1024}MB（这个 ${formatBytes(file.size)}）` }
      }
      if (file.size === 0) return { ok: false, message: '这是个空文件' }

      setUploading(true)
      try {
        const ext = (file.name.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
        const safeName = file.name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 120)
        const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext ? `.${ext}` : ''}`
        const category = detectCategory(file)

        const { error: uploadError } = await supabase.storage
          .from(VAULT_BUCKET)
          .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined })
        if (uploadError) throw uploadError

        const { data, error: insertError } = await supabase
          .from('user_files')
          .insert({
            user_id: userId,
            name: safeName,
            path,
            size: file.size,
            mime: file.type || null,
            category,
          })
          .select('id, name, path, size, mime, category, created_at')
          .single()
        if (insertError) throw insertError

        const created = data as unknown as VaultFile
        setFiles((prev) => [created, ...prev])
        return { ok: true, file: created }
      } catch (err) {
        console.error('上传失败:', err)
        return { ok: false, message: errText(err) }
      } finally {
        setUploading(false)
      }
    },
    [userId],
  )

  /** 删除：先删元数据，再删存储对象 */
  const remove = useCallback(async (item: VaultFile): Promise<UploadOutcome> => {
    if (!userId) return { ok: false, message: '请先登录' }
    setBusyId(item.id)
    try {
      const { error: deleteError } = await supabase.from('user_files').delete().eq('id', item.id).eq('user_id', userId)
      if (deleteError) throw deleteError

      const { error: storageError } = await supabase.storage.from(VAULT_BUCKET).remove([item.path])
      if (storageError) console.error('删除存储对象失败（元数据已删）:', storageError)

      setFiles((prev) => prev.filter((f) => f.id !== item.id))
      return { ok: true }
    } catch (err) {
      console.error('删除失败:', err)
      return { ok: false, message: errText(err) }
    } finally {
      setBusyId(null)
    }
  }, [userId])

  /** 取一个临时下载链接（私有桶必须签名），返回可直接打开的 URL */
  const getDownloadUrl = useCallback(async (item: VaultFile): Promise<{ url?: string; error?: string }> => {
    try {
      const { data, error: signError } = await supabase.storage
        .from(VAULT_BUCKET)
        .createSignedUrl(item.path, 60 * 10, { download: item.name })
      if (signError) throw signError
      if (!data?.signedUrl) return { error: '拿不到下载链接' }
      return { url: data.signedUrl }
    } catch (err) {
      console.error('生成下载链接失败:', err)
      return { error: errText(err) }
    }
  }, [])

  /** 各类别的数量 */
  const counts = useMemo(() => {
    const result: Record<FileCategory, number> = { image: 0, video: 0, audio: 0, doc: 0, archive: 0, other: 0 }
    for (const f of files) result[f.category] += 1
    return result
  }, [files])

  const totalBytes = useMemo(() => files.reduce((sum, f) => sum + f.size, 0), [files])

  return { files, counts, totalBytes, loading, uploading, error, busyId, upload, remove, getDownloadUrl, refresh }
}
