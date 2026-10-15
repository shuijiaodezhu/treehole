import type { Metadata } from "next";
import { Suspense } from "react";
import { Cormorant_Garamond, Noto_Serif_SC } from "next/font/google";
import "./globals.css";
import { OnlinePresence } from "../components/presence";
import { ThemeProvider } from "../components/theme";
import { PageDecor } from "../components/page-decor";
import { LoginTransitionOverlay } from "../components/login-transition";

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

/**
 * 站点地址：用于分享卡片（og:image 必须是绝对地址）。
 * 部署时在环境变量里设 NEXT_PUBLIC_SITE_URL=https://你的域名，
 * 不设的话分享卡片会指向 localhost，微信/QQ 抓不到图。
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
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
    <html lang="zh-CN" className={`${cormorant.variable} ${notoSerif.variable}`}>
      <body>
        {/* 页面配色（用户在设置里改，写进 profiles.theme） */}
        <ThemeProvider>
          {/* 进站即上报当日活跃 + 加入在线频道（后台统计用） */}
          <OnlinePresence />
          {/* 整站边缘的极淡装饰（颜色与图案跟着当前页面走） */}
          <Suspense fallback={null}>
            <PageDecor />
            {/* 登录过场：挂在 layout 上，所以换页时动画不会中断 */}
            <LoginTransitionOverlay />
          </Suspense>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}