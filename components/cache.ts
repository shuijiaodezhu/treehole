/**
 * 极小的共享缓存（先给旧的看到、再去后台对齐）
 *
 * 为什么需要它：
 *   Supabase 每次往返 **~150ms** ✗（实测 ✓）
 *   而头像 / 昵称 / 分区 / 角标这类东西**很少变** ✓ 不值得每次都问一遍 ✗
 *   → 第二次进同一页时，先拿缓存**立刻画出来** ✓（0 请求 ✓ 秒开 ✓）
 *     同时在后台照常取一次 ✓ 回来之后替换掉 ✓
 *
 * 两条存储：
 *   ① 内存（同一个标签页里的页面切换 ✓ 最快 ✓ 连序列化都不用 ✓）
 *   ② localStorage（刷新之后还在 ✓ 关掉标签页就清 ✓ 不会留陈旧数据一整年 ✗）
 *
 * 用法（三行 ✓）：
 *   const [list, setList] = useState(() => peek<Item[]>('key') ?? [])   // 先显示旧的 ✓
 *   useEffect(() => { …取数据…
 *     setList(data); save('key', data)                                  // 取到就存下来 ✓
 *   }, [])
 *
 * ⚠️ 只用来缓存"**慢变**、且**给别人看也无害**"的数据 ✓
 *    绝不拿它缓存"钱 / 权限 / 私密内容"✗（那些每次都要问服务器 ✓）
 */

type Box = { at: number; v: unknown }

const mem = new Map<string, Box>()
const PREFIX = 'treehole:cache:'

/** 默认保鲜期：5 分钟（够"来回切页不重复问"✓ 又不会太陈旧 ✗） */
export const DEFAULT_TTL = 5 * 60 * 1000

/** 立刻拿一份（没有 / 过期 → null ✓ 不阻塞 ✓ 不报错 ✓） */
export function peek<T>(key: string, ttl: number = DEFAULT_TTL): T | null {
  const now = Date.now()

  const hot = mem.get(key)
  if (hot && now - hot.at < ttl) return hot.v as T

  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const box = JSON.parse(raw) as Box
    if (!box || typeof box.at !== 'number' || now - box.at >= ttl) return null
    mem.set(key, box) // 回填内存 ✓
    return box.v as T
  } catch {
    return null
  }
}

/** 存一份（顺带回填内存 ✓） */
export function save(key: string, value: unknown): void {
  const box: Box = { at: Date.now(), v: value }
  mem.set(key, box)
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(box))
  } catch {
    /* 存不下（配额满 / 隐私模式）→ 至少内存里有 ✓ */
  }
}

/** 丢掉某一份（数据被改过之后，主动作废 ✓） */
export function drop(key: string): void {
  mem.delete(key)
  try {
    window.localStorage.removeItem(PREFIX + key)
  } catch {
    /* 忽略 */
  }
}

/** 这个 key 现在有多旧（毫秒；没有则 Infinity）—— 用来决定"要不要真的再问一次" ✓ */
export function age(key: string): number {
  const hot = mem.get(key)
  if (hot) return Date.now() - hot.at
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    if (!raw) return Infinity
    const box = JSON.parse(raw) as Box
    return box && typeof box.at === 'number' ? Date.now() - box.at : Infinity
  } catch {
    return Infinity
  }
}

/**
 * 按 id 列表取资料（头像 / 昵称 / 签名）—— 全站共用一份字典 ✓
 *
 * 为什么值得单独抽出来：
 *   profiles 是**最重也最重复**的一张表 ✗
 *   院子拉过的人 ✓ 进小屋不该再拉一遍 ✗（同一个人、同一台设备 ✓ 白跑一次 150ms ✓）
 *
 * 用法：
 *   const rows = await getProfiles(ids, (missing) =>
 *     supabase.from('profiles').select('id, username, nickname, avatar_url, signature').in('id', missing).then((r) => r.data ?? []),
 *   )
 *
 * 行为：
 *   · 本地已有的 id → **不问服务器** ✓
 *   · 只把缺的那些 id 拿去查 ✓（首次也只查缺的 ✓）
 *   · 查回来并进字典 ✓（下次另一页直接命中 ✓）
 */
const PROFILE_KEY = 'profiles:v1'

export async function getProfiles<T extends { id: string }>(
  ids: string[],
  fetchRows: (missingIds: string[]) => Promise<T[]>,
): Promise<T[]> {
  const uniq = [...new Set(ids.filter(Boolean))]
  if (uniq.length === 0) return []

  const dict = peek<Record<string, T>>(PROFILE_KEY, 30 * 60 * 1000) ?? {}
  const missing = uniq.filter((id) => !dict[id])

  if (missing.length > 0) {
    try {
      const rows = await fetchRows(missing)
      for (const row of rows) {
        if (row && typeof row.id === 'string') dict[row.id] = row
      }
      save(PROFILE_KEY, dict)
    } catch {
      /* 拉不到就先用本地已有的 ✓ 不要因为这一步把整页拖垮 ✗ */
    }
  }

  return uniq.map((id) => dict[id]).filter((x): x is T => Boolean(x))
}
