'use client'

import Link from 'next/link'

/**
 * # 话题标签
 *
 * 不新增数据库字段：话题就写在正文里（形如 #音乐#），
 * 展示时从正文里解析出来渲染成可点的标签，点进去走站内搜索。
 *
 * 规则：# 开头、# 结尾、中间 1-20 个字符且不含 # 与空白。
 */

const HASHTAG_RE = /#([^#\s]{1,20})#/g

/** 解析出正文里的所有话题（去重，保持出现顺序） */
export function parseHashtags(content: string | null | undefined): string[] {
  if (!content) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const match of content.matchAll(HASHTAG_RE)) {
    const tag = (match[1] ?? '').trim()
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    result.push(tag)
  }
  return result
}

/** 点标签后跳到搜索页（搜 #标签# 这段原文） */
export function hashtagHref(tag: string): string {
  return `/search?q=${encodeURIComponent(`#${tag}#`)}`
}

/** 正文之外显示的话题标签行；没有话题就不渲染 */
export function HashtagList({
  content,
  className = '',
  chipClassName = '',
}: {
  content: string | null | undefined
  className?: string
  chipClassName?: string
}) {
  const tags = parseHashtags(content)
  if (tags.length === 0) return null

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {tags.map((tag) => (
        <Link
          key={tag}
          href={hashtagHref(tag)}
          className={
            chipClassName ||
            'rounded-full bg-[#f0f7e8] px-2 py-0.5 text-[11px] text-[#5a8a4a] hover:bg-[#e3f0d8] transition'
          }
        >
          #{tag}
        </Link>
      ))}
    </div>
  )
}
