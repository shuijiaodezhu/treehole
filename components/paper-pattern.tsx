/**
 * 纸纹图案：极淡的点阵 + 几道细弧，整块缓慢漂移
 *
 * 为什么不是"贴一张背景图"：
 *   · 图片要额外请求、要按屏幕倍率出多套，还会在小屏上糊
 *   · 这里就是两个 CSS 渐变 + 一段 SVG，任何尺寸都清晰，体积极小
 * 为什么淡：
 *   图案一浓就抢内容；它的作用只是"让空处不空"，不是被看见
 * 为什么只做很慢的漂移（60s）：
 *   快到能被注意到就会分心；60s 一圈，看久了才发觉纸在动
 */
export function PaperPattern({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {/* 点阵：两像素的点，间距 22px */}
      <div
        className="dsh-pattern-drift absolute inset-[-60px] opacity-[0.5]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(168,86,58,0.10) 1px, transparent 1.2px), radial-gradient(rgba(138,106,74,0.07) 1px, transparent 1.2px)",
          backgroundSize: "22px 22px, 34px 34px",
          backgroundPosition: "0 0, 11px 13px",
        }}
      />
      {/* 几道手绘感的细弧，压在点阵上 */}
      <svg
        className="absolute -left-10 top-10 h-[420px] w-[520px] text-[#e6d9c4]"
        viewBox="0 0 520 420"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      >
        <path d="M-20 320q140-90 300-40t260-30" />
        <path d="M-20 372q160-70 320-26t240-24" />
        <circle cx="430" cy="70" r="54" />
        <circle cx="430" cy="70" r="30" />
      </svg>
    </div>
  );
}

/** 花纹分隔：中间三点，两侧细线 —— 极简排版里的分节记号 */
export function Ornament() {
  return (
    <div aria-hidden="true" className="flex items-center justify-center gap-3 py-2">
      <span className="h-px w-10 bg-[#e6d9c4]" />
      <span className="h-1 w-1 rounded-full bg-[#d9c7a8]" />
      <span className="h-1 w-1 rounded-full bg-[#c9b393]" />
      <span className="h-1 w-1 rounded-full bg-[#d9c7a8]" />
      <span className="h-px w-10 bg-[#e6d9c4]" />
    </div>
  );
}
