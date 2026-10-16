/**
 * 本地库（像 App 一样把东西存在本机）
 *
 * 为什么要它：
 *   Supabase 每次往返约 **150ms**（跨境实测 ✓ 不是美国/欧洲 ✓ 是亚太 ✓）
 *   而"分区 / 我的资料 / 好友列表 / 通知 / 帖子首页"这些东西
 *   **打开时几乎都要用** ✓ 但**变化很慢** ✓ 不值得每次都问 ✗
 *
 * 设计原则（都是踩过坑总结的 ✓）：
 *   ① 两层：内存（同标签页最快 ✓）+ localStorage（关掉再开也还在 ✓）
 *   ② 一切都包在 try 里 —— 隐私模式 / 配额满 / 存不下，都不能让页面崩 ✗
 *   ③ 带过期时间（默认 10 分钟）—— 过期就当没有 ✓ 不会一直用旧数据 ✗
 *   ④ 只存"给别人看也无害"的东西 ✗ 绝不存密码/令牌/私密内容 ✓
 *
 * 用法：
 *   save('categories', list)                      // 存
 *   const list = peek<Category[]>('categories')   // 立刻拿（没有就 null ✓ 不阻塞 ✓）
 *   age('categories')                             // 多旧了（毫秒；没有则 Infinity）
 */

type Box = { at: number; v: unknown }

const mem = new Map<string, Box>()

/** 换版本时改这里 → 旧的本地数据自动作废 ✓（避免字段变了还在用老结构 ✗） */
const PREFIX = 'treehole:store:v1:'

/** 默认保鲜：10 分钟（够"来回切页不重复问"✓ 又不至于太陈旧 ✗） */
export const DEFAULT_TTL = 10 * 60 * 1000

/** 立刻拿一份（没有 / 过期 / 出任何问题 → null ✓ 绝不抛 ✗） */
export function peek<T>(key: string, ttl: number = DEFAULT_TTL): T | null {
  try {
    const now = Date.now()

    const hot = mem.get(key)
    if (hot) {
      if (now - hot.at < ttl) return hot.v as T
      mem.delete(key) // 过期就丢掉 ✓
    }

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

/** 存一份（存不下就只在内存里 ✓ 不报错 ✗） */
export function save(key: string, value: unknown): void {
  const box: Box = { at: Date.now(), v: value }
  mem.set(key, box)
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(box))
  } catch {
    /* 配额满 / 隐私模式 → 至少内存里有 ✓ */
  }
}

/** 丢掉某一份（数据被改过之后主动作废 ✓） */
export function drop(key: string): void {
  mem.delete(key)
  try {
    window.localStorage.removeItem(PREFIX + key)
  } catch {
    /* 忽略 */
  }
}

/** 这个 key 现在多旧（毫秒）。没有 → Infinity ✓ 用来决定"要不要真的再问一次" */
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
 * 给任何 Promise 加一个"超时兜底" ✓
 *
 * 为什么必须有它（真事故 ✓）：
 *   我们踩过一次"整页都在等一个跨境请求"→ 请求不回来 → 页面**永久卡住** ✗
 *   → 凡是"页面要等网络"的地方，一律套这个 ✓
 *   超时了就给 fallback ✓ 让页面继续往下走 ✓
 */
export function withTimeout<T>(p: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true
        resolve(fallback)
      }
    }, ms)
    void Promise.resolve(p).then(
      (v) => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        resolve(v)
      },
      () => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        resolve(fallback)
      },
    )
  })
}
