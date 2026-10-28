"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * 平滑滚动（LENIS）
 *
 * 为什么用它而不是 CSS scroll-behavior: smooth：
 *   CSS 那个只能"跳到锚点"，做不到**连续插值**，滚轮手感是硬的。
 *   LENIS 接管滚轮与触摸，按帧插值，页面像被手推着走 ——
 *   滚动相关的动画（视差、逐段揭示）也才能跟得上帧。
 *
 * 两个分寸：
 *   · 系统开了"减少动态效果"就不接管（无障碍优先，这不是可选项）
 *   · 时长 0.9s、不再叠加自定义缓动 —— 再滑就"飘"了，反而不像纸
 */
export function SmoothScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    /* /v4 是固定布局（左右两栏 sticky 吸顶），Lenis 会给页面套 transform
       → 会破坏 position:sticky ✗ 所以这一页用原生滚动 ✓ */
    if (window.location.pathname.startsWith('/v4')) return;

    const lenis = new Lenis({
      duration: 0.9,
      smoothWheel: true,
      // 触屏交给系统原生滚动：手机上接管触摸十次有九次跟惯性打架
      syncTouch: false,
    });

    let raf = 0;
    const loop = (time: number) => {
      if (window.location.pathname.startsWith('/v4')) {
        lenis.destroy();
        cancelAnimationFrame(raf);
        return;
      }
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return null;
}
