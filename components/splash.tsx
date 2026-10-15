import { SITE_NAME } from "./site-meta";

/**
 * 首次加载的 splash（遮罩式：一块全屏纸色盖住，再淡出）
 *
 * 为什么"只做一次"：
 *   每次刷新都盖一遍，第三次就会烦 —— splash 的意义是"第一次见面打个招呼"，
 *   不是每次都拦。用 sessionStorage 记：同一次浏览会话只出现一次。
 *
 * 为什么不写 React 状态：
 *   显隐完全由 <html data-first-load="1"> + CSS 动画决定。
 *   属性由 layout 里那段内联脚本在**首帧之前**写好，
 *   所以不会有"先闪一下页面再盖上"的空窗，也不会水合不一致。
 *   动画结束后 keyframes 把 visibility 设成 hidden，自动放开点击。
 */
export function Splash() {
  return (
    <div className="dsh-splash" aria-hidden="true">
      <div className="dsh-splash-inner">
        <span className="font-brush text-[34px] tracking-[0.08em] text-[#7a6552] sm:text-[44px]">
          {SITE_NAME}
        </span>
        <span className="mt-3 block h-px w-16 bg-[#d9c7a8] dsh-splash-line" />
      </div>
    </div>
  );
}
