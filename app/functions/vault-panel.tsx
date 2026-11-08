'use client'

import { useRef, useState } from 'react'
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  formatBytes,
  formatTime,
  useVault,
  type FileCategory,
} from '@/components/vault'

/**
 * 储物箱 · v4 风格面板
 *
 * 只复用 components/vault.ts 的数据层（useVault: upload / remove / getDownloadUrl），
 * 界面重新画：纸卡片 + 朱砂强调，跟 /v4 一致。
 */

const CAT_ICON: Record<FileCategory, string> = {
  image: '🖼',
  video: '🎬',
  audio: '♪',
  doc: '📄',
  archive: '🗜',
  other: '•',
}

export function VaultPanel({ userId }: { userId: string | null }) {
  const vault = useVault(userId)
  const [cat, setCat] = useState<FileCategory | 'all'>('all')
  const [msg, setMsg] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const files = (vault.files ?? []).filter((f) => cat === 'all' || f.category === cat)

  const onPick = async (f: File | null | undefined) => {
    if (!f) return
    const r = await vault.upload(f)
    setMsg(r.ok ? '' : r.message ?? '上传失败')
    if (inputRef.current) inputRef.current.value = ''
  }

  const download = async (file: (typeof files)[number]) => {
    const r = await vault.getDownloadUrl(file)
    if (!r.url) {
      setMsg(r.error ?? '取下载链接失败')
      return
    }
    window.open(r.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={"vf-wrap"}>
      <section className={"vf-card v4-glass"}>
        <div className={"vf-head"}>
          <span className={"vf-icon"}>▣</span>
          <div className={"vf-headText"}>
            <span className={"vf-title"}>储物箱</span>
            <span className={"vf-sub"}>只有你自己能看 · 单文件不超过 10MB</span>
          </div>
          <button type="button" className={"vf-up"} onClick={() => inputRef.current?.click()} disabled={vault.uploading}>
            {vault.uploading ? '上传中…' : '+ 存入文件'}
          </button>
          <input
            ref={inputRef}
            type="file"
            className={"vf-file"}
            onChange={(e) => void onPick(e.target.files?.[0])}
          />
        </div>
        {msg && <p className={"vf-err"}>{msg}</p>}
        {vault.error && <p className={"vf-err"}>{vault.error}</p>}
      </section>

      {/* 分类 */}
      <div className={"vf-cats"}>
        <button
          type="button"
          className={'vf-cat' + (cat === 'all' ? ' vf-catOn' : '')}
          onClick={() => setCat('all')}
        >
          全部 <b>{vault.files?.length ?? 0}</b>
        </button>
        {CATEGORY_ORDER.map((c) => (
          <button
            key={c}
            type="button"
            className={'vf-cat' + (cat === c ? ' vf-catOn' : '')}
            onClick={() => setCat(c)}
          >
            {CATEGORY_LABEL[c]} <b>{vault.counts?.[c] ?? 0}</b>
          </button>
        ))}
        <span className={"vf-total"}>共 {formatBytes(vault.totalBytes ?? 0)}</span>
      </div>

      {/* 列表 */}
      {vault.loading ? (
        <p className={"vf-empty"}>读取中…</p>
      ) : files.length === 0 ? (
        <div className={"vf-emptyCard"}>
          <span className={"vf-emptyIcon"}>▤</span>
          <span className={"vf-emptyTitle"}>这里还是空的</span>
          <span className={"vf-emptySub"}>点上面的「存入文件」，图片、文档、压缩包都可以放</span>
        </div>
      ) : (
        <ul className={"vf-list"}>
          {files.map((f) => (
            <li key={f.id} className={"vf-item"}>
              <span className={"vf-fileIcon"}>{CAT_ICON[f.category]}</span>
              <span className={"vf-name"} title={f.name}>
                {f.name}
              </span>
              <span className={"vf-meta"}>{formatBytes(f.size)}</span>
              <span className={"vf-meta vf-metaTime"}>{formatTime(f.created_at)}</span>
              <button type="button" className={"vf-act"} onClick={() => void download(f)}>
                下载
              </button>
              <button
                type="button"
                className={"vf-del"}
                onClick={() => void vault.remove(f)}
                aria-label="删除"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
