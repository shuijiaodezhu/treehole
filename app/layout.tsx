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
import { ThemeApplier } from '../components/theme-applier'
import { BootSync } from '../components/boot-sync'

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
              {/* 字体从 jsDelivr 拉：提前把域名连上，省掉一次 DNS + TLS 握手（约 100-300ms）*/}
        {/*
  内核太旧时的友好提示（放在最前，且**不依赖 React / 新语法**）

  为什么：这个站是 Next.js 16 + React 19，官方要求 Chrome 111+。
    iQOO / vivo 国行机没有 Google Play → 系统 WebView 常年不更新，
    很多还停在 Chrome 60~90 → 打开就是空白或布局挤成一团。
  这段脚本只用 var / function / indexOf / innerHTML（老到不能再老），
  在 React 之前就能判断并直接写出一张**纯行内样式**的提示页。
  判据：color-mix（Chrome 111+）与 :has（105+）都不支持 → 基本可以断定太旧。
*/}
<script
  dangerouslySetInnerHTML={{
    __html: `(function(){try{
      var d=document;
      var sup=(d.defaultView&&d.defaultView.CSS&&CSS.supports)?CSS.supports:null;
      /* 连 CSS.supports 都没有 → 这内核老得不能再老，照样要显示提示
         （上一版这里写成 if(!sup){return} ✗ → 最老的那批反而看不到提示 ✗ 已修）*/
      var tooOld=!sup;
      if(!tooOld){
        var hasColorMix=sup("color","color-mix(in oklab, red, blue)");
        var hasHas=sup("selector(:has(*))");
        /* oklch 是 Tailwind v4 大量用到的（Chrome 111+）
           老内核不认识 → 会把整块 @layer 丢掉 → **全站没样式**（用户看到的就是这个）*/
        var hasOklch=sup("color","oklch(60% 0.15 30)");
        tooOld=!(hasColorMix&&hasHas&&hasOklch);
      }
      if(!tooOld){return;}
      function notice(){
        if(d.getElementById("old-engine-notice")){return;}
        var box=d.createElement("div");
        box.id="old-engine-notice";
        box.setAttribute("style","position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483647;background:#f4ebdd;color:#3f332a;font-family:system-ui,-apple-system,sans-serif;padding:28px 22px;overflow:auto;line-height:1.75");
        box.innerHTML='<div style="max-width:520px;margin:8vh auto 0">'
          +'<div style="font-size:26px;font-weight:700;letter-spacing:1px">你的来信</div>'
          +'<p style="margin:20px 0 10px;font-size:16px">这台手机的内核版本太旧，暂时打不开这个页面。</p>'
          +'<p style="margin:0 0 18px;font-size:14px;color:#6b5c4d">不是你的网络问题，也不用重装 App —— 更新一下系统组件就好。</p>'
          +'<p style="margin:0 0 8px;font-size:15px;font-weight:600">怎么修（1 分钟）：</p>'
          +'<p style="margin:0 0 6px;font-size:14px">1. 打开手机自带的应用商店（vivo/iQOO 就是「应用商店」）</p>'
          +'<p style="margin:0 0 6px;font-size:14px">2. 搜「Android System WebView」（有的显示「WebView」）</p>'
          +'<p style="margin:0 0 18px;font-size:14px">3. 点更新，装完重新打开这个 App</p>'
          +'<p style="margin:0;font-size:13px;color:#8a7a6a">也可以在 设置 → 应用 → 显示系统程序 里查看 WebView 的版本号，低于 111 就是它。</p>'
          +'<p style="margin:22px 0 0;font-size:13px;color:#8a7a6a">（当前内核：WebView 版本偏低）</p>'
          +'</div>';
        /* 插到 <html> 上而不是 <body>：
           React 水合时会重建 body 的子节点，塞在 body 里的提示**会被清掉** ✗
           <html> 那边 React 不碰 → 提示能稳稳留在最上层 */
        d.documentElement.appendChild(box);
      }
      if(d.body){notice();}else{d.addEventListener("DOMContentLoaded",notice);}
    }catch(e){}})()`
  }}
/>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        {/* 数据库域名也提前连上（每个页面第一次查数据都能省一次握手 ✓
            注意：这个地址和 app/lib/supabase.ts 里的是同一个 ✓ 换项目要一起改 ✓）*/}
        <link rel="preconnect" href="https://cdmytrvpskkdwjsenidt.supabase.co" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdmytrvpskkdwjsenidt.supabase.co" />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
{/* 字体：懒加载（见下方说明）—— font-lazy-ok */}
{/*
  霞鹜文楷（正文字体）

  ⚠️ 故意**不用**普通的 <link rel="stylesheet">：
    那个 CSS 有 106KB（里面是 595 段 @font-face 子集声明）
    放在 head 里就是阻塞式样式表 → 首屏白等它 700-900ms

  改成：页面解析完之后再挂上去
    · 首屏立刻画出来（先用后备字体）
    · 字体随后补上（swap，只是字形晚一点切换）
  <noscript> 里保留普通写法，万一没 JS 也还能用
*/}
<script
  dangerouslySetInnerHTML={{
    __html: `(function(){try{var l=document.createElement('link');l.rel='stylesheet';l.href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-lite-webfont@1.7.0/lxgwwenkailite-regular.css";document.head.appendChild(l);}catch(e){}})()`,
  }}
/>
<noscript>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-lite-webfont@1.7.0/lxgwwenkailite-regular.css" />
</noscript>
      <body>
        <ThemeApplier />
        {/* 开屏同步：背后把常用数据拉到本机（只渲染 null，不影响结构）*/}
        <BootSync />
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