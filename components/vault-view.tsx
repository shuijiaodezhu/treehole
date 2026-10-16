'use client'

import { useState } from 'react'
import { Icon, type IconName } from './icons'
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  MAX_FILE_BYTES,
  formatBytes,
  formatTime,
  useVault,
  type FileCategory,
} from './vault'
import { SkeletonList } from './skeleton'
import { EmptyState } from './empty-state'

/**
 * 储物箱界面（放在小屋的第三个页签）
 *
 * 号主私有：单文件 ≤10MB，按类别归档，可下载（签名链接）与删除。
 */

const CATEGORY_ICON: Record<FileCategory, IconName> = {
  image: 'image',
  video: 'video',
  audio: 'music',
  doc: 'file',
  archive: 'box',
  other: 'file',
}

export function VaultView({ userId }: { userId: string | null }) {
  const vault = useVault(userId)
  const [filter, setFilter] = useState<FileCategory | 'all'>('all')
  const [message, setMessage] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const visible = filter === 'all' ? vault.files : vault.files.filter((f) => f.category === filter)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setMessage('')

    let okCount = 0
    for (const file of Array.from(files)) {
      const result = await vault.upload(file)
      if (result.ok) okCount += 1
      else {
        setMessage(`${file.name}：${result.message ?? '上传失败'}`)
        break
      }
    }
    if (okCount > 0) setMessage(`已存入 ${okCount} 个文件`)
  }

  async function handleDownload(path: string) {
    const item = vault.files.find((f) => f.path === path)
    if (!item) return
    setMessage('')
    const { url, error } = await vault.getDownloadUrl(item)
    if (error || !url) {
      setMessage('下载失败：' + (error ?? '未知错误'))
      return
    }
    window.open(url, '_blank', 'noopener')
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* 顶部：容量与上传 */}
      <div className="mb-4 rounded-box border border-base-300 bg-base-100/80 p-5 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-box bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent-light)]">
            <Icon name="box" className="h-5 w-5 text-[var(--accent-deep)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-base-content">储物箱</p>
            <p className="mt-0.5 text-[11px] text-base-content/60">
              只你自己能看 · 单文件不超过 {MAX_FILE_BYTES / 1024 / 1024}MB
              {vault.files.length > 0 && ` · 共 ${vault.files.length} 个 / ${formatBytes(vault.totalBytes)}`}
            </p>
          </div>

          <label
            className={`cursor-pointer rounded-box bg-primary px-4 py-2 text-sm font-medium text-white transition hover:shadow-sm ${
              vault.uploading ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            {vault.uploading ? '上传中…' : '＋ 存入文件'}
            <input
              type="file"
              multiple
              className="hidden"
              disabled={vault.uploading}
              onChange={(e) => {
                void handleFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
        </div>

        {message && <p className="mt-3 text-[11px] text-base-content/60">{message}</p>}
        {vault.error && <p className="mt-3 text-[11px] text-red-500">{vault.error}</p>}
      </div>

      {/* 分类筛选 */}
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`rounded-full px-3 py-1 text-[11px] transition ${
            filter === 'all'
              ? 'bg-primary text-white'
              : 'border border-base-300 bg-base-100 text-base-content/60 hover:border-[var(--accent-light)]'
          }`}
        >
          全部 {vault.files.length}
        </button>
        {CATEGORY_ORDER.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            className={`rounded-full px-3 py-1 text-[11px] transition ${
              filter === c
                ? 'bg-primary text-white'
                : 'border border-base-300 bg-base-100 text-base-content/60 hover:border-[var(--accent-light)]'
            }`}
          >
            {CATEGORY_LABEL[c]} {vault.counts[c]}
          </button>
        ))}
      </div>

      {/* 文件列表 */}
      {vault.loading && vault.files.length === 0 ? (
        <SkeletonList count={2} lines={1} />
      ) : visible.length === 0 ? (
        <div className="rounded-box border border-base-300 bg-base-100/60 backdrop-blur">
          <EmptyState
            art="box"
            title={vault.files.length === 0 ? '储物箱还是空的' : `没有${CATEGORY_LABEL[filter as FileCategory]}类文件`}
            hint="点上面的「存入文件」，图片、文档、压缩包都可以放"
          />
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-3 rounded-box border border-base-300 bg-base-100/80 p-3.5 backdrop-blur"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-box bg-primary/5 text-[var(--accent-deep)]">
                <Icon name={CATEGORY_ICON[f.category]} className="h-4 w-4" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-base-content" title={f.name}>
                  {f.name}
                </p>
                <p className="mt-0.5 text-[11px] text-base-content/60">
                  {CATEGORY_LABEL[f.category]} · {formatBytes(f.size)} · {formatTime(f.created_at)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void handleDownload(f.path)}
                className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-base-300 px-2.5 py-1 text-[11px] text-base-content/60 transition hover:border-[var(--accent-light)] hover:text-[var(--accent-deep)]"
              >
                <Icon name="download" className="h-3.5 w-3.5" />
                下载
              </button>

              {confirmId === f.id ? (
                <button
                  type="button"
                  disabled={vault.busyId === f.id}
                  onClick={async () => {
                    const result = await vault.remove(f)
                    setConfirmId(null)
                    if (!result.ok) setMessage('删除失败：' + (result.message ?? '未知错误'))
                  }}
                  className="flex-shrink-0 rounded-lg bg-red-500 px-2.5 py-1 text-[11px] text-white transition hover:bg-red-600 disabled:opacity-50"
                >
                  {vault.busyId === f.id ? '删除中…' : '确认删除'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmId(f.id)
                    window.setTimeout(() => setConfirmId((cur) => (cur === f.id ? null : cur)), 4000)
                  }}
                  className="flex-shrink-0 rounded-lg border border-base-300 px-2.5 py-1 text-[11px] text-base-content/60 transition hover:border-red-200 hover:text-red-500"
                >
                  删除
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-center text-[11px] leading-relaxed text-[#c0b8ae]">
        文件存在私有空间里，只有你自己能下载；删除后无法恢复。
      </p>
    </div>
  )
}
