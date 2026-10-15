"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * 页面跳转过渡（遮罩式：全屏纸色盖住 → 新页就位 → 揭开）
 *
 * 为什么用遮罩式而不是共享元素式（你给的三档里最不稳的那档）：
 *   共享元素要新旧两个页面同时在场、还要知道元素在哪，
 *   在 App Router 下很容易闪、也容易和滚动位置打架。
 *   遮罩式只是"盖一下"，任何路由情况都不会崩。
 *
 * 实现上**不碰 React 状态**：
 *   · 捕获阶段监听所有站内链接点击 → 给 <html> 加 dsh-navigating
 *   · pathname 变化（新页已就位）→ 去掉这个类 → CSS 过渡揭开
 *   只用 DOM 属性，所以：不会 setState-in-effect，也不会水合不一致。
 *
 * 分寸：修改键点击（新标签）、外链、同页锚点都不拦。
 */
export function PageTransition() {
  const pathname = usePathname();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const el = e.target as HTMLElement | null;
      const a = el?.closest?.("a");
      if (!a) return;

      const href = a.getAttribute("href") || "";
      const target = a.getAttribute("target");
      if (target && target !== "_self") return;
      if (!href.startsWith("/") || href.startsWith("//")) return;
      // 同页（只是 hash 或完全一样）不盖
      if (href === pathname || href.startsWith(pathname + "#")) return;

      document.documentElement.classList.add("dsh-navigating");
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  // 新页面就位 → 揭开
  useEffect(() => {
    document.documentElement.classList.remove("dsh-navigating");
  }, [pathname]);

  return (
    <div className="dsh-nav-mask" aria-hidden="true">
      <span className="font-brush text-[26px] tracking-[0.1em] text-[#8a7460]">你的来信</span>
    </div>
  );
}
