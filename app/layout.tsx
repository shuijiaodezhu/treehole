import type { Metadata } from "next";
import { Cormorant_Garamond, Noto_Serif_SC } from "next/font/google";
import "./globals.css";
import { OnlinePresence } from "../components/presence";

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

export const metadata: Metadata = {
  title: "你的来信 · Dear You",
  description: "这里有一封，你的来信",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${cormorant.variable} ${notoSerif.variable}`}>
      <body>
        {/* 进站即上报当日活跃 + 加入在线频道（后台统计用） */}
        <OnlinePresence />
        {children}
      </body>
    </html>
  );
}