import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Cormorant_Garamond, Ma_Shan_Zheng, Noto_Serif_SC } from "next/font/google";
import "./globals.css";
import { OnlinePresence } from "../components/presence";
import { ThemeProvider } from "../components/theme";
import { SmoothScroll } from "../components/smooth-scroll"
import { Splash } from "../components/splash"
import { PageTransition } from "../components/page-transition"
import { PageDecor } from "../components/page-decor"
import { PaperGrain } from "../components/paper-pattern"
import { Toaster } from "../components/ui/sonner";
import { LoginTransitionOverlay } from "../components/login-transition";
import { ThemeApplier } from '../components/theme-applier'

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
});

const notoSerif = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-noto-serif",
});


/*
 * 毛笔楷书：只用在站名与少数标题上。
 * 艺术字体最忌讳"到处都用" —— 只在标题出现，才有"题字"的分量。
 */
const maShanZheng = Ma_Shan_Zheng({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-brush",
  display: "swap",
});
/**
 * 站点地址：用于分享卡片（og:image 必须是绝对地址）。
 * 部署时在环境变量里设 NEXT_PUBLIC_SITE_URL=https://你的域名，
 * 不设的话分享卡片会指向 localhost，微信/QQ 抓不到图。
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

/*
 * viewportFit: 'cover' —— 让页面铺到 iPhone 的刘海与底部横条后面，
 *   配合 globals.css 里的 env(safe-area-inset-*) 使用；
 *   不加这个，iPhone 底部会留一条黑边，固定底栏也会被横条压住。
 * maximumScale 不设 1：允许用户放大（禁止缩放对看不清的人不友好）。
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f0e8' },
  ],
};

export const metadata: Metadata = {
  /* PWA：iPhone「添加到主屏幕」后全屏显示、状态栏用纸色 */
  appleWebApp: {
    capable: true,
    title: '你的来信',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },

  metadataBase: new URL(SITE_URL),
  title: "你的来信 · Dear You",
  description: "这里有一封，你的来信",
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: SITE_URL,
    siteName: "你的来信",
    title: "你的来信 · Dear You",
    description: "这里有一封，你的来信",
  },
  twitter: {
    card: "summary_large_image",
    title: "你的来信 · Dear You",
    description: "这里有一封，你的来信",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${cormorant.variable} ${notoSerif.variable} ${maShanZheng.variable}`}>
      {/*
        霞鹜文楷（开源楷体）：按需子集加载；拉不到会自动回退，不影响可用性。
        必须带 precedence —— React 19 只会把"声明了优先级"的 stylesheet **提升**到 <head>；
        不带的话它会留在 <html> 里当场报两条错：
          ① Cannot render a <link rel="stylesheet" /> outside the main document without knowing its precedence
          ② In HTML, <link> cannot be a child of <html>（hydration error）
      */}
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-lite-webfont@1.7.0/lxgwwenkai-lite-regular.css"
        precedence="default"
      />
      <body>
        <ThemeApplier />
      {/*
        首次加载才放 splash：这里用内联脚本在**首帧之前**写 html 属性，
        所以不会出现"先看到页面、再被盖住"的空窗。
        sessionStorage：同一次浏览会话只打一次招呼，刷新不再拦。
      */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(!sessionStorage.getItem('dsh:entered')){document.documentElement.setAttribute('data-first-load','1');sessionStorage.setItem('dsh:entered','1')}}catch(e){}`,
        }}
      />

        {/* 页面配色（用户在设置里改，写进 profiles.theme） */}
        <ThemeProvider>
          {/* 进站即上报当日活跃 + 加入在线频道（后台统计用） */}
          <OnlinePresence />
          {/* 整站边缘的极淡装饰（颜色与图案跟着当前页面走） */}
          <Suspense fallback={null}>
            {/* 登录过场：挂在 layout 上，所以换页时动画不会中断 */}
            <LoginTransitionOverlay />
          </Suspense>
          {children}
          <Suspense fallback={null}>
          <PageDecor />
        </Suspense>
        <PaperGrain />
        <SmoothScroll />
        <Splash />
        <Suspense fallback={null}>
          <PageTransition />
        </Suspense>
        <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}