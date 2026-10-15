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


/**
 * 纸纹颗粒：一层极淡的噪点，固定铺满全页
 *
 * 用 SVG 的 feTurbulence 现算噪点，不用图片：
 *   · 图片要么糊、要么大；噪点用滤镜算，任何倍率都是真噪点
 *   · 3.5% 透明度 + 正片叠底 —— 只在斜着看时才发觉"这张纸不光滑"
 * 挂在 layout 上，所以全站每一页都有，不用逐页加
 */
export function PaperGrain() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[5] opacity-[0.035]"
      style={{ mixBlendMode: "multiply" }}
    >
      <svg className="h-full w-full">
        <filter id="dsh-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#dsh-grain)" />
      </svg>
    </div>
  );
}

/**
 * 飘落的小东西（纸屑 / 花瓣）
 *
 * 放在 hero 的信箱插画周围：几点小东西慢慢落下来，主视觉才"活"。
 * 分寸：数量少（6 点）、速度慢（11-16s）、透明度低 —— 让人"觉得有风"，
 * 而不是在看特效。减少动态效果时直接不显示。
 */
const BITS = [
  { left: "16%", delay: 0, dur: 13, size: 6, round: true },
  { left: "34%", delay: 2.6, dur: 16, size: 5, round: false },
  { left: "52%", delay: 1.2, dur: 11, size: 7, round: true },
  { left: "68%", delay: 4.4, dur: 15, size: 5, round: false },
  { left: "84%", delay: 3.1, dur: 14, size: 6, round: true },
  { left: "44%", delay: 6.8, dur: 18, size: 4, round: false },
];

export function FallingBits({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {BITS.map((b, i) => (
        <span
          key={i}
          className="dsh-fall absolute -top-2"
          style={{
            left: b.left,
            width: b.size,
            height: b.size,
            borderRadius: b.round ? "9999px" : "50% 0 50% 0",
            background: i % 2 === 0 ? "rgba(168,86,58,0.34)" : "rgba(217,154,78,0.42)",
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.dur}s`,
          }}
        />
      ))}
    </div>
  );
}
