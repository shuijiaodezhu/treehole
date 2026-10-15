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
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY)
}
