import { createBrowserClient } from '@supabase/ssr'

/**
 * Supabase 客户端
 *
 * 地址与 key **优先读环境变量，读不到就用下面这份默认值**。
 *
 * 为什么留默认值：
 *   · 这个 key 是 publishable（设计上就是公开的），放进前端没有任何问题，
 *     所以写在这里不构成泄露；
 *   · 留着默认值意味着"不配环境变量也能跑"——本地开发、临时部署都不会因为
 *     忘了设变量而白屏。
 *
 * 走环境变量的好处是**换项目不用改代码**：
 *   在 Vercel → Settings → Environment Variables 里设
 *     NEXT_PUBLIC_SUPABASE_URL
 *     NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   重新部署即可指向另一个 Supabase 项目。
 */

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://cdmytrvpskkdwjsenidt.supabase.co'

const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_jSjl7WWkrn9AYMGm1EwLjA_v3yvQRo-'

export function createClient() {
  const client = createBrowserClient(SUPABASE_URL, SUPABASE_KEY)

  /*
   * 兜底：让 auth.getUser() 先看**本地会话**，不再每次都联网 ✗
   *
   * 为什么必须这么做（真事故）：
   *   全项目有 **24 处** 用 `await supabase.auth.getUser()` 判断"登录了吗" ✓
   *   而 getUser() 是**联网**问 Supabase 的 ✗
   *   → 跨境网络抖一下、或在 WebView 里超时 ✗ → 返回的 user 是 null ✗
   *   → 那些页面就 `router.push('/login')` ✓ **把人踢下线** ✓
   *   （你朋友说的"从小屋出来就要重新登录"就是这个 ✓）
   *
   *   而且它还是**加载慢**的一个原因：每进一个页面都白等一次跨境请求 ✗
   *
   * 做法：本地会话（getSession 是读本地 ✓ 瞬时返回 ✓ 不联网 ✓）
   *       有 → 直接用它 ✓（数据安全由数据库那边的 RLS 保证 ✓ 不靠这一步）
   *       本地没有 → 才真的去联网确认一次 ✓（这一种失败才是"真的没登录" ✓）
   */
  const originalGetUser = client.auth.getUser.bind(client.auth)
  client.auth.getUser = (async (...args: Parameters<typeof originalGetUser>) => {
    try {
      const { data } = await client.auth.getSession()
      const localUser = data?.session?.user
      if (localUser) {
        return { data: { user: localUser }, error: null } as Awaited<ReturnType<typeof originalGetUser>>
      }
    } catch {
      /* 读本地都失败（隐私模式等）→ 那就走下面的联网确认 ✓ */
    }
    return originalGetUser(...args)
  }) as typeof client.auth.getUser

  return client
}
