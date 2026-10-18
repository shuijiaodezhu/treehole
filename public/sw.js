/* ============================================================
   你的来信 · Service Worker（离线可用 + 图片/字体一次下载就留着）

   为什么要有它：
     · 静态资源（JS/CSS）和图片每次都要从境外 CDN 拉 ✗ 很慢 ✓
       它们**内容变了文件名就变**（Next 的 chunk 名字带哈希 ✓）→ 可以放心长期缓存 ✓✓
     · 字体来自 jsDelivr（国内慢 ✗）→ 缓存一次之后**再也不下载** ✓✓
     · 断网时至少还能看到上次的页面 ✓（像 App ✓）

   ⚠️ 三条铁律（不守就会出事故 ✗）：
     ① **绝对不缓存** Supabase 的 API / 认证 / 实时连接 ✗
        （那是"实时消息"，必须每次走网络 ✓ 否则会看到过期的数据 ✗）
     ② **页面 HTML 走 network-first** ✗ 永远优先拿新的 ✓
        （缓存优先会让用户**卡在旧版本**上 ✗ 这是最经典的 SW 事故 ✓）
     ③ 换了新版本 → **立刻接管**（skipWaiting + clients.claim）✓
        同时清掉旧版本的缓存 ✓ 不留陈旧副本 ✗

   版本号：改这个文件就顺手改一下 STORE，旧缓存会被清掉 ✓
   ============================================================ */

const STORE = 'yourletters-v1'
const OFFLINE_URLS = ['/', '/manifest.webmanifest', '/icon-192.png']

// ── 安装：把"外壳"里最必要的几个挪进缓存（别的不预缓存 ✗ 免得又慢又占地方）──
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(STORE)
        await cache.addAll(OFFLINE_URLS)
      } catch {
        /* 预缓存失败不影响使用 ✓ */
      }
      // 立刻接班 ✓ 不等旧的 SW 自己退出（这正是"卡在旧版本"的解药 ✓）
      await self.skipWaiting()
    })(),
  )
})

// ── 激活：清掉旧版本的缓存 + 接管所有页面 ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys()
        await Promise.all(keys.filter((k) => k !== STORE).map((k) => caches.delete(k)))
      } catch {
        /* 忽略 */
      }
      await self.clients.claim()
    })(),
  )
})

/** 这个请求该不该被我们接管？（不该 → 原样放走 ✓） */
function shouldHandle(request, url) {
  if (request.method !== 'GET') return false // 写操作一律不碰 ✗

  // ✗ 绝对不碰：Supabase 的 API / 认证 / 实时（那是实时数据 ✓ 必须走网络）
  if (url.hostname.endsWith('.supabase.co')) return false
  if (url.pathname.startsWith('/rest') || url.pathname.startsWith('/auth')) return false

  // ✗ 不碰：站内的 API 路由、带查询参数的数据请求（可能是动态的）
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return false

  return true
}

/** 能长期缓存的静态东西（文件名带哈希 / 图片 / 字体 ✓） */
function isImmutable(url, request) {
  // 背景音乐：11MB，只有点开才下；进了一次缓存就不再吃流量 ✓
  if (url.pathname === "/bgm.mp3") return true
  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/_next/static/')) return true // 带哈希 ✓ 永不变 ✓
    if (/\.(png|jpg|jpeg|webp|gif|svg|ico|woff2?|ttf)$/.test(url.pathname)) return true
  }
  // 字体 CDN（jsDelivr）：内容按版本号固定 ✓ 可以长期留着 ✓
  if (url.hostname === 'cdn.jsdelivr.net') return true
  // 图片：Supabase 的对象存储（不是 rest/auth ✓）
  if (url.hostname.endsWith('.supabase.co') && url.pathname.includes('/storage/')) return true
  return request.destination === 'image'
}

self.addEventListener('fetch', (event) => {
  /* SAFETY-NET：这一层出错绝不能让全站挂
     （今晚的教训：SW 里一行 ReferenceError → 所有请求失败 → 白屏，连自更新都做不到）
     有这层：内部报错 → 不抛出去 → 浏览器至少还能走默认网络请求 ✓ */
  try {
  const request = event.request
  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }

  // 只处理 http(s) ✓ 其他（chrome-extension 等）放走
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return
  if (!shouldHandle(request, url)) return

  // ── ① 静态资源：**缓存优先**（有就直接给 ✓ 没有就下载并留一份）──
  if (isImmutable(url, request)) {
    event.respondWith(
      (async () => {
        try {
          const cache = await caches.open(STORE)
          const hit = await cache.match(request)
          if (hit) return hit
          const res = await fetch(request)
          // 只留成功的、同源的（opaque 的跨域响应也能留 ✓ 但别留错误页 ✗）
          if (res && (res.ok || res.type === 'opaque')) {
            cache.put(request, res.clone()).catch(() => {})
          }
          return res
        } catch {
          const cache = await caches.open(STORE)
          const hit = await cache.match(request)
          if (hit) return hit
          return new Response('', { status: 504, statusText: 'offline' })
        }
      })(),
    )
    return
  }

  // ── ② 页面导航：**网络优先** ✗（永远先拿新的 ✓ 断网才用上次那份）──
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request)
          if (res && res.ok) {
            const cache = await caches.open(STORE)
            cache.put('/', res.clone()).catch(() => {}) // 只留一份"外壳"当离线兜底 ✓
          }
          return res
        } catch {
          const cache = await caches.open(STORE)
          const hit = (await cache.match('/')) || (await cache.match(request))
          if (hit) return hit
          return new Response(
            '<!doctype html><meta charset="utf-8"><title>暂时连不上</title><body style="font-family:system-ui;padding:2rem">暂时连不上网络，等会儿再试一次。</body>',
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
          )
        }
      })(),
    )
    return
  }

  // ── ③ 其他同源 GET（比如 manifest、图标）：网络优先 + 成功就留一份 ──
  event.respondWith(
    (async () => {
      try {
        const res = await fetch(request)
        if (res && res.ok && url.origin === self.location.origin) {
          const cache = await caches.open(STORE)
          cache.put(request, res.clone()).catch(() => {})
        }
        return res
      } catch {
        const cache = await caches.open(STORE)
        const hit = await cache.match(request)
        if (hit) return hit
        return new Response('', { status: 504, statusText: 'offline' })
      }
    })(),
  )
  } catch (e) {
    try { console.error('[sw] fetch error:', e) } catch { /* 忽略 */ }
  }
})
