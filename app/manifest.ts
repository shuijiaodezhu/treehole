import type { MetadataRoute } from 'next'

/**
 * PWA 清单（Next 会自动出 /manifest.webmanifest ✓）
 *
 * 有了它：
 *   · Android（Chrome/夸克）→ 菜单里出现「安装应用 / 添加到主屏幕」✓
 *   · iPhone（Safari）→ 分享 →「添加到主屏幕」✓
 *   → 桌面上出现图标 ✓ 打开是**全屏**（没有地址栏）✓ 像原生 App ✓
 *
 * 主题色用站点的主色（旧信纸那套的陶土红 ✓）：
 *   状态栏、启动画面会跟着它走 ✓
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '你的来信 · Dear You',
    short_name: '你的来信',
    description: '一间小屋、一个院子、几个朋友。没有算法，不推广告。',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f2e8d8',
    theme_color: '#a8563a',
    lang: 'zh-CN',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
