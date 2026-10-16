/**
 * 院子的"一次拿回整页"取数（world_feed 数据库函数）
 *
 * 为什么做它：
 *   实测 Supabase 单次往返 **229ms**（热平均 ✓ 而且抖动大：142~395ms）
 *   院子一页原来要分 4 次问：帖子 → 点赞 → 评论 → 资料
 *   → 4 × 229ms ≈ **900ms** ✗（这就是"切页慢"的一大块 ✓）
 *   现在：数据库里一个事务一次拼好 ✓ 1 × 229ms ✓✓
 *
 * ⚠️ 安全设计（上次就是这里把站点搞挂的 ✗）：
 *   ① 整套包在 try 里 ✓ 任何异常 → 返回 null ✓
 *   ② 带 6 秒超时 ✓ 不回来也返回 null ✓
 *   ③ **页面那边老路原样保留** ✓：这里返回 null 就走老路的 4 次查询 ✓
 *      → 最坏情况只是"没变快"✓ 绝不会卡住 / 白屏 ✓✓
 *
 * 与数据库函数的约定（supabase-world-feed.sql ✓ 你已经在 SQL Editor 跑过了）：
 *   返回 { posts: [...], profiles: [...] }
 *   posts 每项带 like_count / liked_by_me / comments[]
 *   → 这里把它**拼成页面那套代码认识的"行"形状** ✓
 *     这样页面里那段"拼帖子"的逻辑一行都不用改 ✓✓
 */

import { createClient } from '../app/lib/supabase'
import { withTimeout } from './local-store'

export type RawPost = {
  id: string
  author_id: string
  is_anonymous: boolean
  anonymous_id: string | null
  content: string
  category_id: string | null
  created_at: string
  image_urls: string[] | null
}

export type RawComment = {
  id: string
  post_id: string
  author_id: string
  content: string
  created_at: string
  is_anonymous: boolean
  anonymous_id: string | null
  parent_id: string | null
}

export type RawProfile = {
  id: string
  username: string | null
  nickname: string | null
  avatar_url: string | null
  signature?: string | null
}

export type FeedResult = {
  posts: RawPost[]
  likes: { post_id: string; user_id: string }[]
  comments: RawComment[]
  profiles: RawProfile[]
}

/** 超时：6 秒（跨境抖动大 ✓ 超过就别等了 ✓ 走老路 ✓） */
const TIMEOUT_MS = 6000

/**
 * 成功 → 返回拼好的四份数据 ✓
 * 失败 / 超时 / 函数不存在 → 返回 **null** ✓（调用方走老路 ✓）
 */
export async function fetchWorldFeed(
  categoryId: string | null,
  meId: string | null,
): Promise<FeedResult | null> {
  // 不知道"我是谁"就先别走新路：点赞状态要靠 meId 算 ✓ 算错不如不算 ✓
  if (!meId) return null

  try {
    const supabase = createClient()

    /*
     * 显式把它收窄成"只有 data / error"的形状 ✓
     * （Supabase 的原类型带 success/count/status… ✗ 我们的超时兜底没必要凑齐 ✓）
     */
    type RpcShape = { data: unknown; error: { message: string } | null }
    const res = await withTimeout(
      supabase.rpc('world_feed', { p_category_id: categoryId, p_limit: 50 }) as unknown as PromiseLike<RpcShape>,
      TIMEOUT_MS,
      { data: null, error: { message: 'timeout' } } as RpcShape,
    )

    if (!res || res.error || !res.data) return null

    const feed = res.data as {
      posts?: (RawPost & { like_count?: number; liked_by_me?: boolean; comments?: RawComment[] })[]
      profiles?: RawProfile[]
    }

    const rows = feed.posts ?? []
    if (!Array.isArray(rows)) return null

    /*
     * 页面原先是这样算的：
     *   点赞数 = 该帖的 likes 行数 ✓ "我点没点" = likes 里有没有 meId ✓
     * 函数给的是**聚合**结果（like_count / liked_by_me）✓
     * → 这里把它拼成"行"✓ 数出来的结果和原来完全一致 ✓
     *   （用一个不可能等于 meId 的占位 id 补足条数 ✓）
     */
    const likes: { post_id: string; user_id: string }[] = []
    for (const p of rows) {
      const n = Math.max(0, Number(p.like_count ?? 0))
      const mine = Boolean(p.liked_by_me)
      for (let i = 0; i < n; i++) {
        likes.push({ post_id: p.id, user_id: i === 0 && mine && meId ? meId : '__other__' })
      }
    }

    const comments: RawComment[] = []
    for (const p of rows) {
      for (const c of p.comments ?? []) comments.push(c)
    }

    const posts: RawPost[] = rows.map((p) => ({
      id: p.id,
      author_id: p.author_id,
      is_anonymous: p.is_anonymous,
      anonymous_id: p.anonymous_id,
      content: p.content,
      category_id: p.category_id,
      created_at: p.created_at,
      image_urls: p.image_urls ?? null,
    }))

    return { posts, likes, comments, profiles: feed.profiles ?? [] }
  } catch {
    // 任何问题 → null（页面会走老路 ✓ 用户完全无感 ✓）
    return null
  }
}
