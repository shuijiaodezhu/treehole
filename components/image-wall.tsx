'use client'

import { useState } from 'react'
import { Icon } from './icons'
import { useFavorites } from './favorites'

/**
 * 图片墙（可单张收藏）
 *
 * 每张图右上角有心形：点一下就把「这一张图」收藏起来（kind = 'image'，
 * target_id 存图片 URL），点击图片本身则打开大图查看。
 *
 * 与「收藏整条动态」是两件事：卡片底部的收藏按钮收的是动态，
 * 这里收的是单张图，会进「我的收藏 → 图片」。
 */

export function ImageWall({
  urls,
  context,
  authorName,
  favorites,
  className = '',
}: {
  urls: string[] | null | undefined
  /** 这条动态的正文，作为图片收藏的上下文（可空） */
  context?: string | null
  authorName?: string | null
  favorites: ReturnType<typeof useFavorites>
  className?: string
}) {
  const [preview, setPreview] = useState<string | null>(null)
  const list = (urls ?? []).filter(Boolean)
  if (list.length === 0) return null

  const single = list.length === 1

  async function toggleImage(url: string) {
    // toggle 返回切换后的状态；失败时 hook 内部会置 error，这里只需等待完成
    await favorites.toggle({
      kind: 'image',
      targetId: url,
      content: context?.slice(0, 200) ?? null,
      authorName: authorName ?? null,
    })
  }

  return (
    <>
      <div className={`grid gap-2 ${single ? 'grid-cols-1' : list.length === 2 ? 'grid-cols-2' : 'grid-cols-3'} ${className}`}>
        {list.map((url) => {
          const saved = favorites.isFavorited('image', url)
          const busy = favorites.busyKey === `image:${url}`
          return (
            <div key={url} className="group relative">
              <button
                type="button"
                onClick={() => setPreview(url)}
                className="block w-full overflow-hidden rounded-box border border-base-300 focus:outline-none focus:ring-2 focus:ring-primary/30"
                aria-label="查看大图"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className={`w-full object-cover transition duration-200 group-hover:brightness-95 ${
                    single ? 'max-h-80' : 'h-24'
                  }`}
                />
              </button>

              {/* 单张收藏 */}
              <button
                type="button"
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation()
                  void toggleImage(url)
                }}
                aria-label={saved ? '取消收藏这张图' : '收藏这张图'}
                title={saved ? '取消收藏这张图' : '收藏这张图'}
                className={`absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full backdrop-blur transition disabled:opacity-50 ${
                  saved
                    ? 'bg-base-100/90 text-primary'
                    : 'bg-black/35 text-white opacity-0 group-hover:opacity-100 focus:opacity-100'
                }`}
              >
                <Icon name={saved ? 'heartfill' : 'heart'} className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>

      {/* 大图查看 */}
      {preview && (
        <div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/80 px-4 py-8 backdrop-blur-sm"
          onClick={() => setPreview(null)}
        >
          <div className="flex w-full max-w-3xl items-center justify-end gap-2 pb-3">
            <button
              type="button"
              disabled={favorites.busyKey === `image:${preview}`}
              onClick={(e) => {
                e.stopPropagation()
                void toggleImage(preview)
              }}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition disabled:opacity-50 ${
                favorites.isFavorited('image', preview)
                  ? 'bg-primary text-white'
                  : 'bg-base-100/15 text-white hover:bg-base-100/25'
              }`}
            >
              <Icon
                name={favorites.isFavorited('image', preview) ? 'heartfill' : 'heart'}
                className="h-3.5 w-3.5"
              />
              {favorites.isFavorited('image', preview) ? '已收藏' : '收藏这张图'}
            </button>
            <a
              href={preview}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 rounded-full bg-base-100/15 px-3 py-1.5 text-xs text-white transition hover:bg-base-100/25"
            >
              <Icon name="arrow" className="h-3.5 w-3.5" />
              原图
            </a>
            <button
              type="button"
              onClick={() => setPreview(null)}
              aria-label="关闭"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-base-100/15 text-white transition hover:bg-base-100/25"
            >
              <Icon name="x" className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-[75vh] max-w-full rounded-box object-contain shadow-2xl"
          />
        </div>
      )}
    </>
  )
}
