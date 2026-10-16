'use client'
/* eslint-disable @next/next/no-img-element -- 头像用原生 img 即可，尺寸固定 */
/* eslint-disable react-hooks/set-state-in-effect -- 规则未识别 async 取数（init/loadPosts），此处是纯客户端页面 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { readSeenAt, writeSeenAt } from '../../components/module-badges'
import { useWorldRepliesBadge } from '../../components/unread'
import { age, peek, save } from '../../components/local-store'
import { fetchWorldFeed } from '../../components/world-feed'
import { useFocusQuery } from '../../components/use-focus-query'
import { useFavorites } from '../../components/favorites'
import { useDeleteContent } from '../../components/delete-content'
import { useBlocks } from '../../components/blocks'
import { useEditContent } from '../../components/edit-content'
import { HashtagList } from '../../components/hashtags'
import { MentionInput, renderMentions } from '../../components/mentions'
import { ImagePicker } from '../../components/media'
import { EmojiPicker, useEmojiInsert } from '../../components/emoji-picker'
import { ImageWall } from '../../components/image-wall'
import { useFriendList } from '../../components/visibility'
import { pageAccentVars } from '../../components/theme'
import { SkeletonList } from '../../components/skeleton'
import { EmptyState } from '../../components/empty-state'

// 客户端提到模块级，保证引用稳定
const supabase = createClient()

type Category = { id: string; name: string; icon: string | null; parent_id: string | null; sort_order: number }
type Post = {
  id: string; author_id: string; is_anonymous: boolean; anonymous_id: string | null;
  content: string; category_id: string | null; created_at: string;
  author_name: string; author_avatar: string | null;
  like_count: number; liked_by_me: boolean; comments: Comment[];
  image_urls: string[] | null;
}
type Comment = {
  id: string; post_id: string; author_id: string; content: string; created_at: string;
  is_anonymous: boolean; anonymous_id: string | null; parent_id: string | null;
  author_name: string; author_avatar: string | null; parent_name?: string | null;
}

/** 精确跳转（/world?post=<id>）时用到的行类型 */
type FocusCommentRow = {
  id: string
  post_id: string
  author_id: string
  content: string | null
  created_at: string
  is_anonymous: boolean
  anonymous_id: string | null
  parent_id: string | null
}

type FocusProfileRow = {
  id: string
  username: string | null
  nickname: string | null
  avatar_url: string | null
}

function Icon({ name, className = '' }: { name: string; className?: string }) {
  const c = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'back': return <svg {...c}><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
    case 'user': return <svg {...c} strokeWidth={1.6}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.418 3.582-8 8-8s8 3.582 8 8" /></svg>
    case 'send': return <svg {...c}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
    case 'heart': return <svg {...c}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
    case 'heartfill': return <svg {...c} fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
    case 'comment': return <svg {...c}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
    case 'alert': return <svg {...c}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
    case 'pen': return <svg {...c}><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
    case 'home': return <svg {...c}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
    case 'sparkle': return <svg {...c}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
    case 'box': return <svg {...c}><path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
    case 'game': return <svg {...c}><line x1="6" y1="11" x2="10" y2="11" /><line x1="8" y1="9" x2="8" y2="13" /><line x1="15" y1="12" x2="15.01" y2="12" /><line x1="18" y1="10" x2="18.01" y2="10" /><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" /></svg>
    case 'music': return <svg {...c}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
    case 'food': return <svg {...c}><path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" /></svg>
    case 'rain': return <svg {...c}><line x1="16" y1="13" x2="16" y2="21" /><line x1="8" y1="13" x2="8" y2="21" /><line x1="12" y1="15" x2="12" y2="23" /><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" /></svg>
    case 'suitcase': return <svg {...c}><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
    case 'heartbubble': return <svg {...c}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
    case 'spiral': return <svg {...c}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="3" /></svg>
    case 'plus': return <svg {...c} strokeWidth={2}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
    default: return null
  }
}

const categoryIconMap: Record<string, string> = {
  '游戏': 'game', '音乐': 'music', '吃喝': 'food', '压抑': 'rain',
  '旅游': 'suitcase', '感情': 'heartbubble', '抽象': 'spiral',
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function generateAnonymousId() {
  return Math.floor(10000000 + Math.random() * 90000000).toString()
}

export default function WorldPage() {
  // 手机上：分区列表是「二级面板」，点按钮才展开，平时不占屏
  const [showCats, setShowCats] = useState(false)

  const [categories, setCategories] = useState<Category[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [meId, setMeId] = useState<string | null>(null)
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  /*
   * 先用**本机存的那两份**立刻铺出来（分区 + 大厅帖子）
   *
   * 为什么要这样：以前进院子要等 1~2 次跨境往返（每次约 150ms，加上资源更久）
   * 期间是一片骨架/空白。
   * 现在：本机有就直接画 ✓ 再把 loading 关掉 ✓ → 进院子**立刻见内容**
   * 随后照常去服务器拉一次 ✓ 拉到就悄悄换新（不会闪空）
   */
  useEffect(() => {
    const cachedCats = peek<Category[]>('categories')
    const cachedHall = peek<Post[]>('world-list:hall', 2 * 60 * 1000)
    if (!cachedCats && !cachedHall) return
    // 读本机后同步铺上：这条只在客户端跑，而且必须赶在查询回来之前
    if (cachedCats) setCategories(cachedCats)
    if (cachedHall) setPosts(cachedHall)
    setLoading(false)
  }, [])

  const [showPostModal, setShowPostModal] = useState(false)
  const [postContent, setPostContent] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [posting, setPosting] = useState(false)
  const [postCategoryId, setPostCategoryId] = useState<string>('')
  const [postImages, setPostImages] = useState<string[]>([])
  /** 发帖框的表情插入（插到光标处） */
  const { ref: postRef, insert: insertPostEmoji } = useEmojiInsert<HTMLTextAreaElement>(postContent, setPostContent)

  const [showDepressedWarning, setShowDepressedWarning] = useState(false)
  const [depressedCategory, setDepressedCategory] = useState<Category | null>(null)

  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryParent, setNewCategoryParent] = useState<Category | null>(null)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [createCategoryMessage, setCreateCategoryMessage] = useState('')

  const [openCommentPost, setOpenCommentPost] = useState<string | null>(null)
  const [commentInputs, setCommentInputs] = useState<{ [key: string]: string }>({})
  const [commentAnonymous, setCommentAnonymous] = useState<{ [key: string]: boolean }>({})
  const [postingComment, setPostingComment] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null)

  const router = useRouter()

  // 先声明函数，再让 useEffect 调用（修复 "accessed before it is declared"）
  const init = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { router.push('/login'); return }
    setMeId(userData.user.id)
    /*
     * 分区很少变 → 5 分钟内直接用本机那份 ✓ 不再白跑一次跨境往返
     * （超过 5 分钟才重问一次；问到就存回本机 ✓）
     */
    if (age('categories') < 5 * 60 * 1000) {
      const cachedCats = peek<Category[]>('categories')
      if (cachedCats) setCategories(cachedCats)
    } else {
      const { data: cats } = await supabase.from('categories').select('id, name, icon, parent_id, sort_order').eq('status', 'approved').order('sort_order', { ascending: true })
      setCategories((cats || []) as Category[])
      save('categories', cats || [])
    }
    setLoading(false)
  }, [router])

  const loadPosts = useCallback(async (categoryId: string | null) => {
    /*
     * 先拿本机那份**立刻画出来** ✓ 再照常去服务器拉 ✓
     * （所以进院子、切分区都是"先见到内容"，不是先见到空白）
     */
    const listKey = 'world-list:' + (categoryId ?? 'hall')
    const cachedList = peek<Post[]>(listKey, 2 * 60 * 1000)
    if (cachedList && cachedList.length > 0) {
      setPosts(cachedList)
      setLoading(false)

      /*
       * ③ 增量同步（标准折中：中间走增量 + 每 5 分钟完整对齐）
       *
       * 为什么不做"真正只拉新增并拼接"：新帖要显示作者名/头像/评论，
       *   拼接等于要再查一轮资料 ✗ 做半成品反而会出现"新帖没头像"这种毛病
       * 所以这里选**结果一样、但请求少得多**的做法：
       *   · 5 分钟内 → 只问一句「有没有比我缓存更新的帖子」
       *       只取 id、limit 1 → **极小的请求** ✓
       *       没有 → 直接结束（这就是省下来的大头：0 次大请求）
       *       有   → 老老实实走完整对齐（保证质量）
       *   · 超过 5 分钟 → 直接完整对齐（把别人的点赞/评论/删除都拉回来）
       */
      const FULL_ALIGN_MS = 5 * 60 * 1000
      if (age(listKey) < FULL_ALIGN_MS) {
        const newest = cachedList[0]?.created_at
        if (newest) {
          try {
            let probe = supabase
              .from('world_posts')
              .select('id')
              .eq('status', 'published')
              .eq('is_hidden', false)
              .gt('created_at', newest)
              .limit(1)
            probe = categoryId ? probe.eq('category_id', categoryId) : probe.is('category_id', null)
            const { data: newer } = await probe
            // 没有更新的帖子 → 这一轮到此为止（省掉一次完整对齐的跨境往返）
            if (!newer || newer.length === 0) return
          } catch {
            /* 探测失败 → 当作"可能有新的"，往下走完整对齐（宁可多查，不少显示） */
          }
        }
      }
    }

    let query = supabase.from('world_posts').select('id, author_id, is_anonymous, anonymous_id, content, category_id, created_at, image_urls').eq('status', 'published').eq('is_hidden', false).order('created_at', { ascending: false }).limit(50)
    if (categoryId) query = query.eq('category_id', categoryId)
    else query = query.is('category_id', null)

    /*
     * 先试"一次拿回整页"的数据库函数 ✓
     * 一次请求代替下面 4 次（实测每次约 229ms → 4 次约 900ms ✗）
     * 失败 / 超时 / 不知道我是谁 → 返回 null → 下面每行都走**原来的查询** ✓
     * 所以最坏情况只是"没变快" ✓ 绝不会卡住 / 白屏 ✓✓
     */
    const feed = await fetchWorldFeed(categoryId, meId)

    const { data: postsData } = feed ? { data: feed.posts } : await query
    if (!postsData || postsData.length === 0) { setPosts([]); return }

    const postIds = postsData.map((p) => p.id)
    const authorIds = [...new Set(postsData.filter((p) => !p.is_anonymous).map((p) => p.author_id))]
    const likesData = feed
      ? feed.likes
      : (await supabase.from('world_likes').select('post_id, user_id').in('post_id', postIds)).data
    const commentsData = feed
      ? feed.comments
      : (await supabase.from('world_comments').select('id, post_id, author_id, content, created_at, is_anonymous, anonymous_id, parent_id').in('post_id', postIds).order('created_at', { ascending: true })).data

    const commentAuthorIds = commentsData ? [...new Set(commentsData.filter((c) => !c.is_anonymous).map((c) => c.author_id))] : []
    const allAuthorIds = [...new Set([...authorIds, ...commentAuthorIds])]
    const allProfilesData = feed
      ? feed.profiles
      : (await supabase.from('profiles').select('id, username, nickname, avatar_url').in('id', allAuthorIds.length > 0 ? allAuthorIds : ['00000000-0000-0000-0000-000000000000'])).data

    const list: Post[] = postsData.map((p) => {
      const prof = allProfilesData?.find((x) => x.id === p.author_id)
      const postLikes = likesData?.filter((l) => l.post_id === p.id) || []
      const postComments: Comment[] = (commentsData || [])
        .filter((c) => c.post_id === p.id)
        .map((c) => {
          const cp = allProfilesData?.find((x) => x.id === c.author_id)
          let parentName: string | null = null
          if (c.parent_id) {
            const parentComment = commentsData?.find((x) => x.id === c.parent_id)
            if (parentComment) {
              if (parentComment.is_anonymous) {
                parentName = `匿名用户${parentComment.anonymous_id || '00000000'}`
              } else {
                const pp = allProfilesData?.find((x) => x.id === parentComment.author_id)
                parentName = pp?.nickname || pp?.username || '某人'
              }
            }
          }
          return {
            id: c.id, post_id: c.post_id, author_id: c.author_id, content: c.content,
            created_at: c.created_at, is_anonymous: c.is_anonymous, anonymous_id: c.anonymous_id,
            parent_id: c.parent_id,
            author_name: c.is_anonymous ? `匿名用户${c.anonymous_id || '00000000'}` : cp?.nickname || cp?.username || '某人',
            author_avatar: c.is_anonymous ? null : cp?.avatar_url || null,
            parent_name: parentName,
          }
        })

      return {
        id: p.id, author_id: p.author_id, is_anonymous: p.is_anonymous, anonymous_id: p.anonymous_id,
        content: p.content, category_id: p.category_id, created_at: p.created_at,
        author_name: p.is_anonymous ? `匿名用户${p.anonymous_id || '00000000'}` : prof?.nickname || prof?.username || '某人',
        author_avatar: p.is_anonymous ? null : prof?.avatar_url || null,
        like_count: postLikes.length,
        liked_by_me: postLikes.some((l) => l.user_id === meId),
        comments: postComments,
        image_urls: ((p as { image_urls?: string[] | null }).image_urls ?? null),
      }
    })

    setPosts(list)
    save(listKey, list)
  }, [meId])

  function handleCategoryClick(cat: Category) {
    if (cat.name === '压抑' && !cat.parent_id) {
      setDepressedCategory(cat)
      setShowDepressedWarning(true)
      return
    }
    if (!cat.parent_id) {
      setCurrentCategory(cat)
      setExpandedCategory(cat.id)
      return
    }
    setCurrentCategory(cat)
  }

  function selectDepressedSub(cat: Category) {
    setCurrentCategory(cat)
    setShowDepressedWarning(false)
    setDepressedCategory(null)
  }

  async function handlePost(e: React.FormEvent) {
    e.preventDefault()
    if (!postContent.trim() || !meId) return
    setPosting(true)
    const newAnonymousId = isAnonymous ? generateAnonymousId() : null
    // 让数据库把**新插入的那一行**回给我们 ✓ 乐观更新要用它的 id / 时间 ✓
    const { data: inserted, error } = await supabase
      .from('world_posts')
      .insert({
        author_id: meId, content: postContent.trim(), is_anonymous: isAnonymous,
        anonymous_id: newAnonymousId, category_id: postCategoryId || null, status: 'published',
        image_urls: postImages.length > 0 ? postImages : null,
      })
      .select('id, author_id, is_anonymous, anonymous_id, content, category_id, created_at, image_urls')
      .single()
    if (error) { alert('发布失败：' + error.message) }
    else {
      setPostContent(''); setIsAnonymous(false); setShowPostModal(false); setPostImages([])

      /*
       * 乐观：**立刻**把它插到列表最前面 ✓
       * 以前这里要 await loadPosts() → 整页重拉（约 600-900ms）才看得到 ✗
       *
       * 作者名/头像用本机存过的"我的资料"（boot-sync 存的 ✓）拿不到就写"我"✓
       * 如果发到了**别的分区**（不是当前看的这个）→ 不做乐观 ✓ 退回整页重拉兜底 ✓
       */
      const mine = peek<{ nickname?: string | null; username?: string | null; avatar_url?: string | null }>(
        'me-profile',
      )
      const sameCategory = (postCategoryId || null) === (currentCategory?.id ?? null)
      if (inserted && sameCategory) {
        const optimistic: Post = {
          id: inserted.id,
          author_id: inserted.author_id,
          is_anonymous: inserted.is_anonymous,
          anonymous_id: inserted.anonymous_id,
          content: inserted.content,
          category_id: inserted.category_id,
          created_at: inserted.created_at,
          author_name: inserted.is_anonymous
            ? `匿名用户${inserted.anonymous_id || '00000000'}`
            : mine?.nickname || mine?.username || '我',
          author_avatar: inserted.is_anonymous ? null : mine?.avatar_url || null,
          like_count: 0,
          liked_by_me: false,
          comments: [],
          image_urls: inserted.image_urls ?? null,
        }
        const next = [optimistic, ...posts]
        setPosts(next)
        // 顺手写回本机 ✓ 下次进这个分区立刻就有它 ✓
        save('world-list:' + (currentCategory?.id ?? 'hall'), next)
      } else {
        await loadPosts(currentCategory?.id || null)
      }
    }
    setPosting(false)
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newCategoryName.trim() || !meId) return
    setCreatingCategory(true)
    setCreateCategoryMessage('')
    const { error } = await supabase.from('categories').insert({
      name: newCategoryName.trim(), parent_id: newCategoryParent?.id || null,
      status: 'pending', created_by: meId,
    })
    if (error) { setCreateCategoryMessage('提交失败：' + error.message) }
    else {
      setCreateCategoryMessage('已提交，等待站主审核')
      setNewCategoryName('')
      setTimeout(() => { setShowNewCategoryModal(false); setNewCategoryParent(null); setCreateCategoryMessage('') }, 1500)
    }
    setCreatingCategory(false)
  }


  /** 点「⋯」菜单里的任何按钮后，把那个菜单收起来（原生 details，不需要状态） */
  function closePostMenu(e: React.MouseEvent<HTMLDivElement>) {
    const t = e.target as HTMLElement | null
    if (!t || !t.closest('button')) return
    const d = t.closest('details')
    if (d) d.open = false
  }

  async function handleLike(postId: string, liked: boolean) {
    if (!meId) return

    /*
     * 乐观更新（学抖音点赞）✓
     *
     * 以前：先写数据库 → **等回来** → 还顺手把整页重拉一遍 ✗
     *       （4 次跨境查询约 600ms ✗ 所以你点了半天才变 ✓）
     * 现在：**先把界面改掉** ✓ 立刻变红/变灰 ✓ 数字立刻加减 ✓
     *       再去写数据库 ✓ 写失败才回滚 ✓
     *       **完全不再重拉整页** ✗
     */
    const before = posts
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              liked_by_me: !liked,
              like_count: Math.max(0, (p.like_count ?? 0) + (liked ? -1 : 1)),
            }
          : p,
      ),
    )

    try {
      const { error } = liked
        ? await supabase.from('world_likes').delete().eq('post_id', postId).eq('user_id', meId)
        : await supabase.from('world_likes').insert({ post_id: postId, user_id: meId })
      if (error) throw error
    } catch (err) {
      // 写失败 → 把界面**还原**（不能让用户看到假的点赞状态 ✗）
      console.error('点赞失败，已还原:', err)
      setPosts(before)
    }
  }

  /* ---------- 上次看到这里 ---------- */
  const [seenAt, setSeenAt] = useState<string | null>(null)

  // 有人回我（评论我的帖 / 回复我的评论）的未读数
  // 只解构出稳定的值：count 是数字 ✓ markRead / refresh 是 useCallback ✓
  // （整包 replies 每次渲染都是新对象 ✗ 放进依赖会死循环 ✓）
  const {
    count: repliesCount,
    items: repliesItems,
    markRead: markRepliesRead,
    refresh: refreshReplies,
  } = useWorldRepliesBadge(meId)

  // 悬浮列表：开关 + 已经点过（跳过去了）的帖子
  const [showReplies, setShowReplies] = useState(false)
  const [handledPosts, setHandledPosts] = useState<string[]>([])
  const pendingReplies = repliesItems.filter((it) => !handledPosts.includes(it.postId))

  // 列表里都处理完了 → 这时才算"都看过了"，清掉红点 ✓
  useEffect(() => {
    if (repliesItems.length > 0 && pendingReplies.length === 0) markRepliesRead()
  }, [repliesItems.length, pendingReplies.length, markRepliesRead])

  /** 跳到某条帖子并高亮 2 秒（悬浮列表里点哪条就传哪条 ✓）*/
  const jumpToPost = useCallback(
    (postId: string) => {
      setHandledPosts((prev) => (prev.includes(postId) ? prev : [...prev, postId]))
      setShowReplies(false)

      const find = () => document.querySelector(`[data-post-id="${postId}"]`)
      const go = (el: Element) => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('ring-2', 'ring-primary')
        window.setTimeout(() => el.classList.remove('ring-2', 'ring-primary'), 2000)
      }
      const el = find()
      if (el) {
        go(el)
        return
      }
      // 不在当前分区（比如你在别的分区看）→ 先切回大厅，再跳一次
      setCurrentCategory(null)
      setExpandedCategory(null)
      window.setTimeout(() => {
        const again = find()
        if (again) go(again)
      }, 600)
    },
    [setCurrentCategory, setExpandedCategory],
  )

  /*
   * 打开院子 = 看过"有人回了你"了 → 清掉那个提示。
   * 原来这里**只显示、不清** ✗（markRead 从来没被调用过）
   * → 于是红点永远消不掉 ✓ 这就是"回复的红点消不掉" ✓
   * 延 1.5 秒再清：至少让人**看见**它一下，不然一闪就没了反而像没提示 ✓
   */
  useEffect(() => {
    if (repliesCount <= 0) return
    const timer = window.setTimeout(() => markRepliesRead(), 60000)
    return () => window.clearTimeout(timer)
  }, [repliesCount, markRepliesRead])

  // 收藏
  const favorites = useFavorites(meId)

  // 删除自己发的帖子 / 评论（两步确认，避免误触）
  const deleter = useDeleteContent(meId)

  // 拉黑：被拉黑（含拉黑我的）的内容一律不显示
  const blocks = useBlocks(meId)

  /* ---------- 编辑自己发的帖子 / 评论 ---------- */
  const editor = useEditContent(meId)

  /* ---------- @ 功能：评论里能叫人 ---------- */
  const { friends: mentionFriends } = useFriendList(meId)
  const mentionNames = mentionFriends.map((f) => f.name)

  async function handleSavePost(postId: string) {
    const text = editor.draft.trim()
    const result = await editor.save('world_post', postId, text)
    if (!result.ok) {
      alert('保存失败：' + (result.message ?? '未知错误'))
      return
    }
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, content: text } : p)))
  }

  async function handleSaveComment(commentId: string) {
    const text = editor.draft.trim()
    const result = await editor.save('world_comment', commentId, text)
    if (!result.ok) {
      alert('保存失败：' + (result.message ?? '未知错误'))
      return
    }
    setPosts((prev) =>
      prev.map((p) => ({
        ...p,
        comments: p.comments.map((c) => (c.id === commentId ? { ...c, content: text } : c)),
      })),
    )
  }

  /* ---------- 举报帖子：可举报、可撤回 ---------- */
  const [reportedPosts, setReportedPosts] = useState<Set<string>>(new Set())
  const [reportedComments, setReportedComments] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!meId) return
    let cancelled = false
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('reports')
          .select('target_id, target_type')
          .eq('reporter_id', meId)
          .in('target_type', ['world_post', 'world_comment'])
          .eq('status', 'pending')
        if (error) throw error
        if (!cancelled) {
          const rows = (data ?? []) as { target_id: string; target_type: string }[]
          setReportedPosts(new Set(rows.filter((r) => r.target_type === 'world_post').map((r) => r.target_id)))
          setReportedComments(
            new Set(rows.filter((r) => r.target_type === 'world_comment').map((r) => r.target_id)),
          )
        }
      } catch (err) {
        console.error('查询我的举报失败:', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [meId])

  async function handleReportPost(postId: string) {
    if (!meId) return
    const reason = window.prompt('举报这条帖子的原因？（会发给站主看）')
    if (reason === null) return
    const text = reason.trim() || '未填写原因'
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: meId,
        target_type: 'world_post',
        target_id: postId,
        reason: text,
        status: 'pending',
      })
      if (error) throw error
      setReportedPosts((prev) => new Set(prev).add(postId))
      alert('已收到，谢谢你的反馈。误报可以在同一条帖子上点「撤回举报」。')
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : String(err)
      alert('举报失败：' + msg)
    }
  }

  async function handleWithdrawPostReport(postId: string) {
    if (!meId) return
    try {
      const { error } = await supabase
        .from('reports')
        .delete()
        .eq('reporter_id', meId)
        .eq('target_type', 'world_post')
        .eq('target_id', postId)
      if (error) throw error
      setReportedPosts((prev) => {
        const next = new Set(prev)
        next.delete(postId)
        return next
      })
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : String(err)
      alert('撤回失败：' + msg)
    }
  }
  async function handleReportComment(commentId: string) {
    if (!meId) return
    const reason = window.prompt('举报这条评论的原因？（会发给站主看）')
    if (reason === null) return
    const text = reason.trim() || '未填写原因'
    const { error } = await supabase.from('reports').insert({
      reporter_id: meId,
      target_type: 'world_comment',
      target_id: commentId,
      reason: text,
      status: 'pending',
    })
    if (error) {
      alert('举报失败：' + error.message)
      return
    }
    setReportedComments((prev) => new Set(prev).add(commentId))
    alert('已收到，谢谢你的反馈。误报可以在同一条评论上点「撤回举报」。')
  }

  async function handleWithdrawCommentReport(commentId: string) {
    if (!meId) return
    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('reporter_id', meId)
      .eq('target_type', 'world_comment')
      .eq('target_id', commentId)
    if (error) {
      alert('撤回失败：' + error.message)
      return
    }
    setReportedComments((prev) => {
      const next = new Set(prev)
      next.delete(commentId)
      return next
    })
  }

  const [confirmDeletePost, setConfirmDeletePost] = useState<string | null>(null)
  const [confirmDeleteComment, setConfirmDeleteComment] = useState<string | null>(null)

  async function handleDeletePost(postId: string, authorId: string) {
    const result = await deleter.deletePost(postId, authorId)
    setConfirmDeletePost(null)
    if (!result.ok) alert('删除失败：' + (result.message ?? '未知错误'))
  }

  async function handleDeleteComment(commentId: string, authorId: string) {
    const result = await deleter.deleteComment(commentId, authorId)
    setConfirmDeleteComment(null)
    if (!result.ok) alert('删除失败：' + (result.message ?? '未知错误'))
  }

  // 进页面就算看过：读上一次的时间戳（用来画「上次看到这里」），
  // 然后立刻把它推进到现在，这样返回主页时提示点/角标就消失了。
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      setSeenAt(readSeenAt('world'))
      writeSeenAt('world', new Date().toISOString())
      setSeenAt(new Date().toISOString())
      // 看过这一趟，回复角标一并归零
      refreshReplies()
    })
    return () => window.cancelAnimationFrame(id)
  }, [refreshReplies])

  // 第一/最后一条新帖的位置：用来插「上次看到这里」的标记
  const newPostIndex = useMemo(() => {
    if (!seenAt || posts.length === 0) return -1
    const seenTime = new Date(seenAt).getTime()
    const idx = posts.findIndex((p) => new Date(p.created_at).getTime() > seenTime)
    if (idx < 0) return -1
    // 全是最新的帖子时不插线（整页都是新的）
    return idx > 0 ? idx : -1
  }, [posts, seenAt])

  /* ---------- 从搜索页精确跳转：/world?post=<id> ---------- */
  const focusPostId = useFocusQuery('post')

  // 定位模式：只渲染这一条帖子
  const visiblePosts = useMemo(
    () =>
      (focusPostId ? posts.filter((p) => p.id === focusPostId) : posts)
        .filter((p) => deleter.postVisible(p))
        .filter((p) => !blocks.hiddenIds.has(p.author_id)),
    [posts, focusPostId, deleter, blocks.hiddenIds],
  )

  /** 已确认不存在（帖子被删或不可见）时才提示 */
  const [focusMissing, setFocusMissing] = useState(false)

  useEffect(() => {
    if (!focusPostId) return
    let cancelled = false

    const run = async () => {
      try {
        const { data, error } = await supabase
          .from('world_posts')
          .select('id, author_id, is_anonymous, anonymous_id, content, category_id, created_at, image_urls')
          .eq('id', focusPostId)
          .eq('status', 'published')
          .eq('is_hidden', false)
          .maybeSingle()

        if (error) throw error
        if (cancelled) return

        if (!data) {
          setPosts([])
          setFocusMissing(true)
          return
        }

        const [likesRes, commentsRes] = await Promise.all([
          supabase.from('world_likes').select('post_id, user_id').eq('post_id', data.id),
          supabase
            .from('world_comments')
            .select('id, post_id, author_id, content, created_at, is_anonymous, anonymous_id, parent_id')
            .eq('post_id', data.id)
            .order('created_at', { ascending: true }),
        ])

        const likes = likesRes.data ?? []
        const commentRows = (commentsRes.data ?? []) as unknown as FocusCommentRow[]

        // 一次把「帖子作者 + 评论作者」的资料查出来
        const authorIds = [
          ...new Set([
            ...(data.is_anonymous ? [] : [data.author_id]),
            ...commentRows.filter((c) => !c.is_anonymous).map((c) => c.author_id),
          ]),
        ]

        const profilesRes = authorIds.length
          ? await supabase
              .from('profiles')
              .select('id, username, nickname, avatar_url')
              .in('id', authorIds)
          : { data: [] as FocusProfileRow[] }

        if (cancelled) return

        const allProfiles = (profilesRes.data ?? []) as unknown as FocusProfileRow[]
        const profileOf = (uid: string) => allProfiles.find((x) => x.id === uid) ?? null
        const nameOf = (uid: string) => {
          const p = profileOf(uid)
          return p?.nickname?.trim() || p?.username?.trim() || '某人'
        }

        const authorProfile = profileOf(data.author_id)
        const comments: Comment[] = commentRows.map((c) => ({
          id: c.id,
          post_id: c.post_id,
          author_id: c.author_id,
          content: c.content ?? '',
          created_at: c.created_at,
          is_anonymous: c.is_anonymous,
          anonymous_id: c.anonymous_id,
          parent_id: c.parent_id,
          author_name: c.is_anonymous ? `匿名用户${c.anonymous_id || '00000000'}` : nameOf(c.author_id),
          author_avatar: c.is_anonymous ? null : profileOf(c.author_id)?.avatar_url ?? null,
          parent_name: c.parent_id ? nameOf(commentRows.find((x) => x.id === c.parent_id)?.author_id ?? '') : null,
        }))

        setFocusMissing(false)
        setPosts([
          {
            id: data.id,
            author_id: data.author_id,
            is_anonymous: data.is_anonymous,
            anonymous_id: data.anonymous_id,
            content: data.content,
            category_id: data.category_id,
            created_at: data.created_at,
            author_name: data.is_anonymous
              ? `匿名用户${data.anonymous_id || '00000000'}`
              : authorProfile?.nickname?.trim() || authorProfile?.username?.trim() || '某人',
            author_avatar: data.is_anonymous ? null : authorProfile?.avatar_url ?? null,
            like_count: likes.length,
            liked_by_me: likes.some((l) => l.user_id === meId),
            comments,
            image_urls: data.image_urls ?? null,
          },
        ])
        // 定位到的帖子默认展开评论
        setOpenCommentPost(data.id)
      } catch (err) {
        console.error('定位帖子失败:', err)
        if (!cancelled) setFocusMissing(true)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [focusPostId, meId])

  async function handlePostComment(postId: string) {
    const text = commentInputs[postId]?.trim()
    if (!text || !meId) return
    setPostingComment(postId)
    const anon = commentAnonymous[postId] || false
    // 先把「回复谁」抓住——下面紧接着就要把它清掉
    const replyTarget = replyingTo
    const parentId = replyTarget?.parent_id || replyTarget?.id || null

    // 让数据库把新插入的评论行回给我们（乐观更新要用它的 id / 时间）
    const { data: inserted, error } = await supabase
      .from('world_comments')
      .insert({
        post_id: postId, author_id: meId, content: text,
        is_anonymous: anon,
        anonymous_id: anon ? generateAnonymousId() : null,
        parent_id: parentId,
      })
      .select('id, post_id, author_id, content, created_at, is_anonymous, anonymous_id, parent_id')
      .single()

    if (error) { alert('评论失败：' + error.message) }
    else {
      setCommentInputs({ ...commentInputs, [postId]: '' })
      setCommentAnonymous({ ...commentAnonymous, [postId]: false })
      setReplyingTo(null)

      /*
       * 乐观：立刻把这条评论挂上去
       * 以前这里 await loadPosts() → 整页重拉（约 600-900ms）才看得到自己的评论
       */
      const mine = peek<{ nickname?: string | null; username?: string | null; avatar_url?: string | null }>(
        'me-profile',
      )
      if (inserted) {
        const optimistic: Comment = {
          id: inserted.id,
          post_id: inserted.post_id,
          author_id: inserted.author_id,
          content: inserted.content,
          created_at: inserted.created_at,
          is_anonymous: inserted.is_anonymous,
          anonymous_id: inserted.anonymous_id,
          parent_id: inserted.parent_id,
          author_name: inserted.is_anonymous
            ? `匿名用户${inserted.anonymous_id || '00000000'}`
            : mine?.nickname || mine?.username || '我',
          author_avatar: inserted.is_anonymous ? null : mine?.avatar_url || null,
          parent_name: replyTarget ? replyTarget.author_name : null,
        }
        const next = posts.map((p) =>
          p.id === postId ? { ...p, comments: [...p.comments, optimistic] } : p,
        )
        setPosts(next)
        save('world-list:' + (currentCategory?.id ?? 'hall'), next)
      } else {
        // 拿不到新行（老数据库没开 return=representation 等）→ 退回整页重拉兜底
        await loadPosts(currentCategory?.id || null)
      }
    }
    setPostingComment(null)
  }

  useEffect(() => { init() }, [init])

  useEffect(() => {
    if (meId) loadPosts(currentCategory?.id || null)
  }, [currentCategory, meId, loadPosts])

  const topCategories = categories.filter((c) => !c.parent_id)
  const currentLocationName = currentCategory ? currentCategory.name : '大厅'
  const selectedCategoryName = postCategoryId
    ? categories.find((c) => c.id === postCategoryId)?.name || '大厅'
    : '大厅'

  if (loading) {
    return (
      <div className="min-h-screen bg-base-content/5" style={pageAccentVars('world')}>
        <div className="mx-auto max-w-6xl px-6 pt-24 pb-8">
          <SkeletonList count={3} lines={3} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base-content/5 relative overflow-hidden" style={pageAccentVars('world')}>

      <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-8">
        <header className="mb-6">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-base-content/60 hover:text-primary transition">
            <Icon name="back" className="w-4 h-4" />返回
          </Link>
          <h1 className="text-3xl font-bold text-base-content mt-4">院子</h1>
          <p className="text-sm text-base-content/60 mt-1">瞧瞧Ta们在干啥</p>
        </header>

              {/* 手机上：分区列表收进二级面板，点这里展开/收起（电脑上隐藏，侧栏常显）*/}
      <button
        type="button"
        onClick={() => setShowCats((v) => !v)}
        aria-expanded={showCats}
        className="mb-3 flex w-full items-center justify-between rounded-box bg-base-100 px-4 py-2.5 text-sm text-base-content transition-colors hover:bg-base-content/5 lg:hidden"
      >
        <span className="flex items-center gap-2">
          <Icon name="spiral" className="h-4 w-4 text-base-content/60" />
          分区 · {currentLocationName}
        </span>
        <span className="text-base-content/60">{showCats ? '▴' : '▾'}</span>
      </button>
      {/*
        永远可见的发帖按钮
        （原来它在"分区"侧栏里 ✗ 而侧栏在手机上默认隐藏 →
          必须先点「分区」才能发帖 ✓ 用户报的"发帖键消失，按分组才显示"）
        现在放在两栏之上：手机/桌面、开不开分区，都看得见
      */}
      <button
        onClick={() => { setPostCategoryId(currentCategory?.id || ''); setShowPostModal(true) }}
        className="mb-4 bg-primary w-full py-2.5 rounded-box text-primary-content text-sm font-medium hover:shadow-sm transition-all flex flex-col items-center justify-center gap-0.5"
      >
        <span className="flex items-center gap-2"><Icon name="pen" className="w-4 h-4" />发帖</span>
        <span className="text-[11px] text-white/80 font-normal">发到「{currentLocationName}」</span>
      </button>

      <div className="flex flex-col gap-5 lg:flex-row lg:min-h-[600px]">
          <aside
          className={
            'w-full flex-shrink-0 flex-col gap-3 lg:flex lg:w-56 ' + (showCats ? 'flex' : 'hidden')
          }
        >

            <div className="card rounded-box border border-base-300 bg-base-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 ">
                <p className="text-[11px] text-base-content/60 tracking-wide">分区 · 看哪儿的帖子</p>
              </div>
              <div className="p-2">
                <button
                  onClick={() => { setCurrentCategory(null); setExpandedCategory(null); setShowCats(false) }}
                  className={`w-full text-left px-3 py-2 rounded-box text-sm transition flex items-center gap-2 ${!currentCategory ? 'bg-base-content/5 text-primary font-medium' : 'text-base-content hover:bg-base-content/5'}`}
                >
                  <Icon name="home" className="w-4 h-4" />大厅
                </button>

                {topCategories.map((cat) => {
                  const children = categories.filter((c) => c.parent_id === cat.id)
                  const isActive = currentCategory?.id === cat.id || currentCategory?.parent_id === cat.id
                  const isExpanded = expandedCategory === cat.id
                  return (
                    <div key={cat.id}>
                      <button
                        onClick={() => { handleCategoryClick(cat); setShowCats(false) }}
                        className={`w-full text-left px-3 py-2 rounded-box text-sm transition flex items-center justify-between ${isActive ? 'bg-base-content/5 text-primary font-medium' : 'text-base-content hover:bg-base-content/5'}`}
                      >
                        <span className="flex items-center gap-2">
                          <Icon name={categoryIconMap[cat.name] || 'spiral'} className="w-4 h-4" />
                          {cat.name}
                        </span>
                        <span className="text-[11px] text-base-content/60">{isExpanded ? '▾' : '▸'}</span>
                      </button>

                      {isExpanded && (
                        <div className="ml-4 mt-1 space-y-0.5">
                          {children.length === 0 && (<p className="px-3 py-1.5 text-[11px] text-base-content/60">暂无子区</p>)}
                          {children.map((sub) => (
                            <button
                              key={sub.id}
                              onClick={() => { setCurrentCategory(sub); setShowCats(false) }}
                              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition ${currentCategory?.id === sub.id ? 'bg-base-content/5 text-primary font-medium' : 'text-base-content/60 hover:bg-base-content/5'}`}
                            >
                              {sub.name}
                            </button>
                          ))}
                          <button
                            onClick={() => { setNewCategoryParent(cat); setShowNewCategoryModal(true) }}
                            className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-base-content/60 hover:bg-base-content/5 transition"
                          >
                            + 新建子区
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}

                <button
                  onClick={() => { setNewCategoryParent(null); setShowNewCategoryModal(true) }}
                  className="w-full text-left px-3 py-2 rounded-box text-sm text-base-content/60 hover:bg-base-content/5 transition flex items-center gap-2 mt-1"
                >
                  <Icon name="plus" className="w-4 h-4" />新建分区
                </button>
              </div>
            </div>

            <div className="card rounded-box border border-base-300 bg-base-100 shadow-sm overflow-hidden">
              <Link href="/friends" className="flex items-center gap-2 px-4 py-3 text-sm text-base-content hover:bg-base-content/5 transition ">
                <Icon name="home" className="w-4 h-4 text-base-content/60" />小屋
              </Link>
              <Link href="/play" className="flex items-center gap-2 px-4 py-3 text-sm text-base-content hover:bg-base-content/5 transition ">
                <Icon name="sparkle" className="w-4 h-4 text-base-content/60" />派对
              </Link>
              <Link href="/me" className="flex items-center gap-2 px-4 py-3 text-sm text-base-content hover:bg-base-content/5 transition">
                <Icon name="box" className="w-4 h-4 text-base-content/60" />我的
              </Link>
            </div>
          </aside>

          <main className="flex-1 min-w-0">
            <div className="mb-3 flex items-center gap-2 text-xs text-base-content/60">
              <span>正在看：</span><span className="text-primary font-medium">{currentLocationName}</span>
              {pendingReplies.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowReplies((v) => !v)}
                    title="点开看看是哪几条帖子被回了"
                    className="ml-1 flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-primary transition-colors hover:bg-primary/20"
                  >
                    <span className="min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-content text-[11px] leading-4 text-center font-medium">
                      {repliesCount > 99 ? '99+' : repliesCount}
                    </span>
                    <span>有人回了你</span>
                    <span className="text-[10px]">{showReplies ? '▴' : '▾'}</span>
                  </button>

                  {showReplies && (
                    <>
                      {/* 点空白处关掉 */}
                      <div className="fixed inset-0 z-40" onClick={() => setShowReplies(false)} />
                      <div className="absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-lg">
                        <p className="px-3 py-2 text-[11px] text-base-content/60">
                          被回复的帖子（{pendingReplies.length}）
                        </p>
                        {pendingReplies.map((it) => (
                          <button
                            key={it.postId}
                            type="button"
                            onClick={() => jumpToPost(it.postId)}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-base-content/5"
                          >
                            <span className="min-w-0 flex-1 truncate text-base-content">
                              「{it.snippet}」
                            </span>
                            <span className="flex-shrink-0 text-[11px] text-primary">
                              {it.count} 条 ›
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {focusPostId && (
                <div className="flex items-center justify-between rounded-box border border-base-300 bg-base-content/5 px-4 py-2.5">
                  <span className="text-xs text-primary">
                    {focusMissing ? '这条帖子不见了（可能已被删除）' : '正在看搜索到的那一条'}
                  </span>
                  <Link href="/world" className="text-xs text-primary hover:underline">
                    ← 回到列表
                  </Link>
                </div>
              )}

              {visiblePosts.length === 0 ? (
                <div className="card rounded-box border border-base-300 bg-base-100/60 backdrop-blur">
                  <EmptyState
                    art={focusMissing ? 'search' : 'leaf'}
                    title={focusMissing ? '没能找到这条帖子' : '这里还空空的'}
                    hint={focusMissing ? '它可能被作者删除了，或被站主隐藏' : '点左边「发帖」，写第一条吧'}
                  />
                </div>
              ) : (
                visiblePosts.map((post, index) => (
                  <div key={post.id} data-post-id={post.id}>
                    {!focusPostId && index === newPostIndex && (
                      <div className="relative mb-3 flex items-center gap-3 py-1">
                        <span className="h-px flex-1 bg-base-300" />
                        <span className="text-[11px] text-base-content/60 tracking-wide">上次看到这里</span>
                        <span className="h-px flex-1 bg-base-300" />
                      </div>
                    )}

                    <div className="card rounded-box border border-base-300 bg-base-100 p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      {post.is_anonymous ? (
                        <div className="w-10 h-10 rounded-box bg-base-300 flex items-center justify-center flex-shrink-0">
                          <Icon name="user" className="w-5 h-5 text-base-content/60" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-box bg-gradient-to-br from-base-300 to-base-300 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {post.author_avatar ? <img loading="lazy" decoding="async" src={post.author_avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-sm text-primary font-semibold">{post.author_name[0]}</span>}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-base-content truncate">{post.author_name}</p>
                        <p className="text-[11px] text-base-content/60 mt-0.5">{formatTime(post.created_at)}</p>
                      </div>
                    </div>
                    {editor.isEditing('world_post', post.id) ? (
                      <div className="pl-1">
                        <textarea
                          value={editor.draft}
                          onChange={(e) => editor.setDraft(e.target.value)}
                          rows={4}
                          maxLength={editor.maxLength.world_post}
                          autoFocus
                          className="w-full px-3 py-2 rounded-box border border-base-300 bg-base-content/5 text-sm text-base-content resize-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
                        />
                        <div className="flex items-center gap-3 mt-2">
                          <button
                            type="button"
                            disabled={editor.isBusy('world_post', post.id)}
                            onClick={() => void handleSavePost(post.id)}
                            className="rounded-lg bg-primary px-3 py-1 text-xs text-primary-content hover:bg-primary transition disabled:opacity-50"
                          >
                            {editor.isBusy('world_post', post.id) ? '保存中…' : '保存'}
                          </button>
                          <button
                            type="button"
                            onClick={() => editor.cancel()}
                            className="rounded-lg border border-base-300 px-3 py-1 text-xs text-base-content/60 hover:bg-base-content/5 transition"
                          >
                            取消
                          </button>
                          <span className="ml-auto text-[11px] text-base-content/60">
                            {editor.draft.length}/{editor.maxLength.world_post}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-base-content whitespace-pre-wrap break-words leading-relaxed pl-1">
                        {post.content}
                        {editor.wasSaved('world_post', post.id) && (
                          <span className="ml-2 text-[11px] text-primary">已保存</span>
                        )}
                      </p>
                    )}

                    {/* 图片墙（每张可单独收藏） */}
                    <ImageWall
                      urls={post.image_urls}
                      context={post.content}
                      authorName={post.author_name}
                      favorites={favorites}
                      className="mt-3 pl-1"
                    />

                    {/* 正文里的话题标签 */}
                    <HashtagList content={post.content} className="mt-2 pl-1" />

                    <div className="flex items-center gap-4 pl-1 pt-3 mt-3 ">
                      <button
                        onClick={() => handleLike(post.id, post.liked_by_me)}
                        className={`flex items-center gap-1.5 text-xs transition ${post.liked_by_me ? 'text-primary' : 'text-base-content/60 hover:text-primary'}`}
                      >
                        <Icon name={post.liked_by_me ? 'heartfill' : 'heart'} className="w-4 h-4" />
                        <span>{post.like_count > 0 ? post.like_count : '赞'}</span>
                      </button>
                      <button
                        onClick={() => { setOpenCommentPost(openCommentPost === post.id ? null : post.id); setReplyingTo(null) }}
                        className={`flex items-center gap-1.5 text-xs transition ${openCommentPost === post.id ? 'text-primary' : 'text-base-content/60 hover:text-primary'}`}
                      >
                        <Icon name="comment" className="w-4 h-4" />
                        <span>{post.comments.length > 0 ? post.comments.length : '评论'}</span>
                      </button>

                      {/*
                        其余都收进「⋯」菜单
                        为什么：收藏 + 编辑 + 删除 + 举报 一起挤在这一排时，
                        手机上标签会被压成两行（「评」「论」各占一行），很难看
                        用原生 <details> 折叠：不需要 React 状态，最不容易出问题
                        点菜单里任何按钮后会自动收起（见 closePostMenu）
                      */}
                      <div className="relative ml-auto" onClick={closePostMenu}>
                        <details className="th-post-menu">
                          <summary
                            className="flex h-7 w-8 cursor-pointer list-none items-center justify-center rounded-full text-base-content/55 transition hover:bg-base-content/5 hover:text-base-content"
                            aria-label="更多操作"
                          >
                            {/* Icon 里没有 more 图标，直接用文字 ⋯（任何字体都有，最稳） */}
                            <span className="text-base leading-none tracking-widest">⋯</span>
                          </summary>
                          <div className="absolute right-0 bottom-full z-20 mb-1 w-36 overflow-hidden rounded-box border border-base-300 bg-base-100 py-1 shadow-sm">
                            <button
                              type="button"
                              onClick={() =>
                                void favorites.toggle({
                                  kind: 'world_post',
                                  targetId: post.id,
                                  content: post.content,
                                  authorName: post.author_name,
                                })
                              }
                              disabled={favorites.busyKey === `world_post:${post.id}`}
                              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition disabled:opacity-50 ${
                                favorites.isFavorited('world_post', post.id)
                                  ? 'text-primary'
                                  : 'text-base-content/70 hover:bg-base-content/5 hover:text-primary'
                              }`}
                            >
                              <Icon
                                name={favorites.isFavorited('world_post', post.id) ? 'heartfill' : 'heart'}
                                className="w-3.5 h-3.5"
                              />
                              {favorites.isFavorited('world_post', post.id) ? '已收藏' : '收藏'}
                            </button>

                            {editor.canEdit(post.author_id) && !editor.isEditing('world_post', post.id) && (
                              <button
                                type="button"
                                onClick={() => editor.start('world_post', post.id, post.content)}
                                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition text-base-content/70 hover:bg-base-content/5 hover:text-primary`}
                              >
                                <Icon name="pen" className="w-3.5 h-3.5" />
                                编辑
                              </button>
                            )}

                            {deleter.canDelete(post.author_id) && (
                              confirmDeletePost === post.id ? (
                                <button
                                  type="button"
                                  disabled={deleter.busyId === post.id}
                                  onClick={() => void handleDeletePost(post.id, post.author_id)}
                                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition text-red-500 hover:bg-red-500/5 disabled:opacity-50`}
                                >
                                  <Icon name="trash" className="w-3.5 h-3.5" />
                                  {deleter.busyId === post.id ? '删除中…' : '确认删除'}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmDeletePost(post.id)
                                    window.setTimeout(
                                      () => setConfirmDeletePost((cur) => (cur === post.id ? null : cur)),
                                      4000,
                                    )
                                  }}
                                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition text-base-content/70 hover:bg-base-content/5 hover:text-red-500`}
                                >
                                  <Icon name="trash" className="w-3.5 h-3.5" />
                                  删除
                                </button>
                              )
                            )}

                            {/* 不能举报自己（作者就是自己时不显示） */}
                            {post.author_id !== meId && (
                              <button
                                type="button"
                                onClick={() =>
                                  reportedPosts.has(post.id)
                                    ? void handleWithdrawPostReport(post.id)
                                    : void handleReportPost(post.id)
                                }
                                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition ${
                                  reportedPosts.has(post.id)
                                    ? 'text-base-content/60 hover:bg-base-content/5'
                                    : 'text-base-content/70 hover:bg-base-content/5 hover:text-red-500'
                                }`}
                              >
                                <Icon name="alert" className="w-3.5 h-3.5" />
                                {reportedPosts.has(post.id) ? '撤回举报' : '举报'}
                              </button>
                            )}
                          </div>
                        </details>
                      </div>
                    </div>

                    {openCommentPost === post.id && (
                      <div className="mt-4 pl-1">
                        {post.comments.length > 0 && (
                          <div className="space-y-3 mb-4">
                            {post.comments
                              .filter((c) => !c.parent_id)
                              .filter((c) => deleter.commentVisible(c.id))
                              .filter((c) => !blocks.hiddenIds.has(c.author_id))
                              .map((parent) => {
                              const replies = post.comments.filter(
                                (c) =>
                                  c.parent_id === parent.id &&
                                  deleter.commentVisible(c.id) &&
                                  !blocks.hiddenIds.has(c.author_id),
                              )
                              return (
                                <div key={parent.id}>
                                  <div className="flex gap-2">
                                    {parent.is_anonymous ? (
                                      <div className="w-6 h-6 rounded-full bg-base-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <Icon name="user" className="w-3 h-3 text-base-content/60" />
                                      </div>
                                    ) : (
                                      <div className="w-6 h-6 rounded-full bg-base-300 flex items-center justify-center overflow-hidden flex-shrink-0 mt-0.5">
                                        {parent.author_avatar ? <img loading="lazy" decoding="async" src={parent.author_avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-[11px] text-primary">{parent.author_name[0]}</span>}
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0 bg-base-content/5 rounded-box px-3 py-2">
                                      <p className="text-[11px] font-medium text-primary">{parent.author_name}</p>
                                      {editor.isEditing('world_comment', parent.id) ? (
                                        <div className="mt-1">
                                          <textarea
                                            value={editor.draft}
                                            onChange={(e) => editor.setDraft(e.target.value)}
                                            rows={2}
                                            maxLength={editor.maxLength.world_comment}
                                            autoFocus
                                            className="w-full px-2 py-1.5 rounded-lg border border-base-300 bg-base-100 text-xs text-base-content resize-none focus:outline-none focus:border-primary transition"
                                          />
                                          <div className="flex items-center gap-2 mt-1">
                                            <button
                                              type="button"
                                              disabled={editor.isBusy('world_comment', parent.id)}
                                              onClick={() => void handleSaveComment(parent.id)}
                                              className="rounded-md bg-primary px-2 py-0.5 text-[11px] text-primary-content hover:bg-primary transition disabled:opacity-50"
                                            >
                                              {editor.isBusy('world_comment', parent.id) ? '保存中…' : '保存'}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => editor.cancel()}
                                              className="rounded-md border border-base-300 px-2 py-0.5 text-[11px] text-base-content/60 transition"
                                            >
                                              取消
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <p className="text-xs text-base-content mt-0.5 whitespace-pre-wrap break-words">
                                          {renderMentions(parent.content, mentionNames)}
                                          {editor.wasSaved('world_comment', parent.id) && (
                                            <span className="ml-1.5 text-[11px] text-primary">已保存</span>
                                          )}
                                        </p>
                                      )}
                                      <div className="flex items-center justify-between mt-1 gap-2">
                                        <div className="flex items-center gap-2">
                                          <button onClick={() => setReplyingTo(parent)} className="text-[11px] text-base-content/60 hover:text-primary">回复</button>
                                          {editor.canEdit(parent.author_id) && !editor.isEditing('world_comment', parent.id) && (
                                            <button
                                              onClick={() => editor.start('world_comment', parent.id, parent.content)}
                                              className="text-[11px] text-base-content/60 hover:text-primary transition"
                                            >
                                              编辑
                                            </button>
                                          )}
                                          {deleter.canDelete(parent.author_id) && (
                                            confirmDeleteComment === parent.id ? (
                                              <button
                                                disabled={deleter.busyId === parent.id}
                                                onClick={() => void handleDeleteComment(parent.id, parent.author_id)}
                                                className="text-[11px] text-red-500 hover:underline disabled:opacity-50"
                                              >
                                                {deleter.busyId === parent.id ? '删除中…' : '确认删除'}
                                              </button>
                                            ) : (
                                              <button
                                                onClick={() => {
                                                  setConfirmDeleteComment(parent.id)
                                                  window.setTimeout(
                                                    () => setConfirmDeleteComment((cur) => (cur === parent.id ? null : cur)),
                                                    4000,
                                                  )
                                                }}
                                                className="text-[11px] text-base-content/60 hover:text-red-500 transition"
                                              >
                                                删除
                                              </button>
                                            )
                                          )}
                                        </div>
                                        <span className="text-[11px] text-base-content/60">{formatTime(parent.created_at)}</span>
                                      </div>
                                    </div>
                                  </div>
                                  {replies.length > 0 && (
                                    <div className="ml-8 mt-2 space-y-1.5">
                                      {replies.map((c) => (
                                        <div key={c.id} className="flex gap-2">
                                          {c.is_anonymous ? (
                                            <div className="w-5 h-5 rounded-full bg-base-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                                              <Icon name="user" className="w-2.5 h-2.5 text-base-content/60" />
                                            </div>
                                          ) : (
                                            <div className="w-5 h-5 rounded-full bg-base-300 flex items-center justify-center overflow-hidden flex-shrink-0 mt-0.5">
                                              {c.author_avatar ? <img loading="lazy" decoding="async" src={c.author_avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-[11px] text-primary">{c.author_name[0]}</span>}
                                            </div>
                                          )}
                                          <div className="flex-1 min-w-0 bg-base-content/5 rounded-box px-3 py-1.5">
                                            <p className="text-[11px] text-base-content leading-relaxed">
                                              <span className="font-medium text-primary">{c.author_name}</span>
                                              {c.parent_name && (<><span className="text-base-content/60"> 回复 </span><span className="font-medium text-primary">{c.parent_name}</span></>)}
                                              <span className="text-base-content/60">：</span>
                                              {editor.isEditing('world_comment', c.id) ? null : (
                                                <span className="ml-1">{renderMentions(c.content, mentionNames)}</span>
                                              )}
                                            </p>
                                            {editor.isEditing('world_comment', c.id) && (
                                              <div className="mt-1 flex items-center gap-2">
                                                <input
                                                  value={editor.draft}
                                                  onChange={(e) => editor.setDraft(e.target.value)}
                                                  maxLength={editor.maxLength.world_comment}
                                                  autoFocus
                                                  className="flex-1 rounded-lg border border-base-300 bg-base-100 px-2 py-1 text-[11px] text-base-content focus:outline-none focus:border-primary transition"
                                                />
                                                <button
                                                  type="button"
                                                  disabled={editor.isBusy('world_comment', c.id)}
                                                  onClick={() => void handleSaveComment(c.id)}
                                                  className="rounded-md bg-primary px-2 py-0.5 text-[11px] text-primary-content hover:bg-primary transition disabled:opacity-50"
                                                >
                                                  {editor.isBusy('world_comment', c.id) ? '…' : '保存'}
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => editor.cancel()}
                                                  className="rounded-md border border-base-300 px-2 py-0.5 text-[11px] text-base-content/60 transition"
                                                >
                                                  取消
                                                </button>
                                              </div>
                                            )}
                                            <div className="flex items-center justify-between mt-1 gap-2">
                                              <div className="flex items-center gap-2">
                                                <button onClick={() => setReplyingTo(c)} className="text-[11px] text-base-content/60 hover:text-primary">回复</button>
                                                {c.author_id !== meId && (
                                                  <button
                                                    onClick={() =>
                                                      reportedComments.has(c.id)
                                                        ? void handleWithdrawCommentReport(c.id)
                                                        : void handleReportComment(c.id)
                                                    }
                                                    className="text-[11px] text-base-content/60 transition hover:text-primary"
                                                    title={reportedComments.has(c.id) ? '撤回举报' : '举报'}
                                                  >
                                                    {reportedComments.has(c.id) ? '已举报' : '举报'}
                                                  </button>
                                                )}
                                                {editor.canEdit(c.author_id) && !editor.isEditing('world_comment', c.id) && (
                                                  <button
                                                    onClick={() => editor.start('world_comment', c.id, c.content)}
                                                    className="text-[11px] text-base-content/60 hover:text-primary transition"
                                                  >
                                                    编辑
                                                  </button>
                                                )}
                                                {deleter.canDelete(c.author_id) && (
                                                  confirmDeleteComment === c.id ? (
                                                    <button
                                                      disabled={deleter.busyId === c.id}
                                                      onClick={() => void handleDeleteComment(c.id, c.author_id)}
                                                      className="text-[11px] text-red-500 hover:underline disabled:opacity-50"
                                                    >
                                                      {deleter.busyId === c.id ? '删除中…' : '确认删除'}
                                                    </button>
                                                  ) : (
                                                    <button
                                                      onClick={() => {
                                                        setConfirmDeleteComment(c.id)
                                                        window.setTimeout(
                                                          () => setConfirmDeleteComment((cur) => (cur === c.id ? null : cur)),
                                                          4000,
                                                        )
                                                      }}
                                                      className="text-[11px] text-base-content/60 hover:text-red-500 transition"
                                                    >
                                                      删除
                                                    </button>
                                                  )
                                                )}
                                              </div>
                                              <span className="text-[11px] text-base-content/60">{formatTime(c.created_at)}</span>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {replyingTo && (
                          <div className="flex items-center justify-between mb-2 px-2">
                            <p className="text-[11px] text-base-content/60">正在回复 <span className="text-primary font-medium">{replyingTo.author_name}</span></p>
                            <button onClick={() => setReplyingTo(null)} className="text-[11px] text-base-content/60 hover:text-primary">取消</button>
                          </div>
                        )}

                        <div className="flex gap-2 items-center">
                          <MentionInput
                            meId={meId}
                            value={commentInputs[post.id] || ''}
                            onChange={(next) => setCommentInputs({ ...commentInputs, [post.id]: next })}
                            onEnter={() => handlePostComment(post.id)}
                            placeholder={replyingTo ? `回复 ${replyingTo.author_name}… 输入 @ 叫人` : '写点什么… 输入 @ 叫人'}
                            maxLength={200}
                            withEmoji
                            className="w-full px-4 py-2 rounded-full border border-base-300 bg-base-content/5 text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
                          />
                          <label className="flex items-center gap-1 text-[11px] text-base-content/60 cursor-pointer flex-shrink-0">
                            <input type="checkbox" checked={commentAnonymous[post.id] || false} onChange={(e) => setCommentAnonymous({ ...commentAnonymous, [post.id]: e.target.checked })} className="accent-primary" />
                            匿名
                          </label>
                          <button
                            onClick={() => handlePostComment(post.id)}
                            disabled={postingComment === post.id || !commentInputs[post.id]?.trim()}
                            className="bg-primary px-4 py-2 rounded-full from-base-300 text-primary-content text-xs font-medium transition-all disabled:opacity-50 flex-shrink-0"
                          >
                            {postingComment === post.id ? '...' : '发送'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                ))
              )}
            </div>
          </main>
        </div>
      </div>

      {showPostModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center px-4" onClick={() => setShowPostModal(false)}>
          <form onSubmit={handlePost} className="bg-base-100 rounded-box w-full max-w-lg p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-base-content mb-4">发帖</h2>
            <div className="mb-4">
              <label className="block text-xs text-base-content/60 mb-1.5 tracking-wide">发到哪里</label>
              <select value={postCategoryId} onChange={(e) => setPostCategoryId(e.target.value)} className="w-full px-4 py-2.5 rounded-box border border-base-300 bg-base-content/5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition">
                <option value="">🏠 大厅</option>
                {topCategories.map((cat) => (
                  <optgroup key={cat.id} label={cat.name}>
                    <option value={cat.id}>{cat.name}（全部）</option>
                    {categories.filter((c) => c.parent_id === cat.id).map((sub) => (
                      <option key={sub.id} value={sub.id}>{cat.name} · {sub.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="text-[11px] text-base-content/60 mt-1.5">这条会发到「<span className="text-primary">{selectedCategoryName}</span>」</p>
            </div>
            <textarea ref={postRef} value={postContent} onChange={(e) => setPostContent(e.target.value)} placeholder="写点什么… 用 #话题# 加标签，也可以发个表情" rows={5} maxLength={500} autoFocus className="w-full px-4 py-3 rounded-box border border-base-300 bg-base-content/5 text-sm resize-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition mb-4" />

            {/* 图片：本地上传或粘贴链接 */}
            <ImagePicker
              userId={meId}
              urls={postImages}
              onChange={setPostImages}
              disabled={posting}
            />
            <div className="flex items-center justify-between mb-5">
              <label className="flex items-center gap-2 text-sm text-base-content cursor-pointer">
                <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} className="accent-primary" />
                匿名发布
              </label>
              <div className="flex items-center gap-2">
                <EmojiPicker onPick={insertPostEmoji} align="right" />
                <span className="text-xs text-base-content/60">{postContent.length}/500</span>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowPostModal(false)} className="px-5 py-2 rounded-box text-sm text-base-content/60 hover:bg-base-content/5 transition">取消</button>
              <button type="submit" disabled={posting || !postContent.trim()} className="bg-primary px-5 py-2 rounded-box from-base-300 text-primary-content text-sm font-medium hover:shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5">
                <Icon name="send" className="w-3.5 h-3.5" />
                {posting ? '发布中...' : '发送'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showNewCategoryModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center px-4" onClick={() => setShowNewCategoryModal(false)}>
          <form onSubmit={handleCreateCategory} className="bg-base-100 rounded-box w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-base-content mb-1">新建{newCategoryParent ? '子区' : '分区'}</h2>
            <p className="text-xs text-base-content/60 mb-4">{newCategoryParent ? `在「${newCategoryParent.name}」下新建` : '建好后需要站主审核，通过后才可见'}</p>
            <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="分区名字" maxLength={10} autoFocus className="w-full px-4 py-2.5 rounded-box border border-base-300 bg-base-content/5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition mb-4" />
            {createCategoryMessage && <p className={`text-xs mb-3 ${createCategoryMessage.includes('失败') ? 'text-red-500' : 'text-green-600'}`}>{createCategoryMessage}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setShowNewCategoryModal(false); setNewCategoryName(''); setNewCategoryParent(null); setCreateCategoryMessage('') }} className="px-5 py-2 rounded-box text-sm text-base-content/60 hover:bg-base-content/5 transition">取消</button>
              <button type="submit" disabled={creatingCategory || !newCategoryName.trim()} className="bg-primary px-5 py-2 rounded-box from-base-300 text-primary-content text-sm font-medium hover:shadow-sm transition-all disabled:opacity-50">
                {creatingCategory ? '提交中...' : '提交审核'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showDepressedWarning && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-4" onClick={() => { setShowDepressedWarning(false); setDepressedCategory(null) }}>
          <div className="bg-base-100 rounded-box w-full max-w-md p-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <Icon name="alert" className="w-5 h-5 text-base-content/70" />
              <h2 className="text-lg font-semibold text-base-content">进区前，请先看一眼</h2>
            </div>
            <div className="space-y-3 text-sm text-base-content leading-relaxed mb-6">
              <p>这里的内容可能引起不适，请确认你愿意接受，再继续。</p>
              <p><span className="text-primary font-medium">1.</span> 有些话会比较重，请照顾好自己。</p>
              <p><span className="text-primary font-medium">2.</span> 可以说，但请守住底线：不伤人，不挑事，不违法。</p>
              <p><span className="text-primary font-medium">3.</span> 匿名发帖时，注意你的口头禅、错别字、说话习惯——它们可能会暴露你。想真匿名，就少写细节。</p>
            </div>
            <p className="text-xs text-base-content/60 mb-3 text-center">请选择：</p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {categories.filter((c) => c.parent_id === depressedCategory?.id).map((sub) => (
                <button key={sub.id} onClick={() => selectDepressedSub(sub)} className="py-3 rounded-box border-2 border-base-300 bg-base-content/5 text-sm text-base-content hover:border-primary hover:bg-base-content/5 transition">{sub.name}</button>
              ))}
            </div>
            <button onClick={() => { setShowDepressedWarning(false); setDepressedCategory(null) }} className="w-full py-2 text-xs text-base-content/60 hover:text-primary transition">离开</button>
          </div>
        </div>
      )}
    </div>
  )
}