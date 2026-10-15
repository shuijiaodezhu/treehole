'use client'

/**
 * 雪中分别（与冬日信箱同款画风）
 *
 * 按你的要求画：
 *   · 女生在左、稍微矮一点；男生在右、高一些；两人**面对面**
 *   · 男生的手抬到**女生头的右上方，作挡雪状**（这是整幅画的"眼"）
 *   · 两人都穿厚衣服但**不臃肿** —— 像毛衣：圆肩、直身，只加两三笔针织纹
 *   · 女生围着围巾，围巾尾巴往后飘一点点（风就有了）
 *   · 不画五官：低头、侧身、一只手挡雪，比表情更含蓄
 *
 * 画法与冬日信箱一致：线宽 1.6、圆头圆角、暖赭描边；
 * 只填三色（雪白 #fdf8f0 / 浅绯 #f2d3c6 / 暖赭实心点）。
 */
export function WinterScene({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 200"
      className={className}
      fill="none"
      stroke="#c4705a"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="雪中分别：女生在左，男生在右，两人面对面，男生的手抬在女生头上方替她挡雪"
    >
      {/* 雪地 */}
      <path d="M4 178q52-12 116-6t116-8" />
      <path d="M0 188q64-10 132-4t108-6" fill="#fdf8f0" />

      {/* 飘雪 */}
      <g fill="#f2d3c6" stroke="none">
        <circle cx="26" cy="34" r="2.6" />
        <circle cx="62" cy="18" r="2" />
        <circle cx="104" cy="30" r="2.4" />
        <circle cx="150" cy="16" r="2" />
        <circle cx="196" cy="40" r="2.6" />
        <circle cx="216" cy="86" r="2" />
        <circle cx="40" cy="72" r="2" />
        <circle cx="184" cy="112" r="2.2" />
      </g>

      {/* 男生抬起来挡雪的那只手附近：雪落在手背上的两点 */}
      <g fill="#c4705a" stroke="none" opacity="0.55">
        <circle cx="112" cy="34" r="1.6" />
        <circle cx="124" cy="26" r="1.4" />
      </g>

      {/* ── 女生（左，稍矮）── */}
      <g>
        {/* 头 */}
        <circle cx="86" cy="74" r="10" fill="#fdf8f0" />
        {/* 头发：齐颈的圆弧 */}
        <path d="M76 70q4-11 14-9t6 13" />
        {/* 身体：毛衣 —— 圆肩直身，不臃肿 */}
        <path d="M74 178v-58q0-16 12-16t12 16v58" fill="#f2d3c6" />
        <path d="M74 178v-58q0-16 12-16t12 16v58" />
        {/* 针织纹：三笔短横 */}
        <path d="M80 124h13M80 136h13M80 148h13" opacity="0.55" />
        {/* 围巾：一圈 + 往后飘的一笔 */}
        <path d="M74 108q12 7 24 0" />
        <path d="M98 108q10 3 16 10" />
        {/* 垂在身侧的手 */}
        <path d="M74 132q-5 8-3 16" opacity="0.7" />
      </g>

      {/* ── 男生（右，高一些，面向女生）── */}
      <g>
        {/* 头 */}
        <circle cx="150" cy="62" r="11" fill="#fdf8f0" />
        {/* 头发：短，一笔 */}
        <path d="M139 58q7-10 20-4" />
        {/* 身体：毛衣，肩膀比女生宽一点、个子高一点 */}
        <path d="M136 178v-64q0-17 14-17t14 17v64" fill="#f2d3c6" />
        <path d="M136 178v-64q0-17 14-17t14 17v64" />
        {/* 针织纹 */}
        <path d="M142 128h15M142 141h15M142 154h15" opacity="0.55" />
        {/* 领口 */}
        <path d="M140 100q10 6 20 0" />
        {/* 挡住雪的那只手臂：从肩上抬到女生头上方 */}
        <path d="M140 104q-14-10-26-24" strokeWidth="2.2" />
        {/* 手掌：三笔短弧 */}
        <path d="M114 80q-6-4-9-9M114 80q-3-6-4-11M114 80q1-6 0-11" strokeWidth="1.8" />
        {/* 另一只手垂着 */}
        <path d="M164 130q5 8 3 16" opacity="0.7" />
        {/* 面向女生：内侧肩线往里收一点 */}
        <path d="M140 112q6 4 10 4" opacity="0.6" />
      </g>

      {/* 两人之间的一点暖 */}
      <path d="M118 148q4-5 8-1t-8 9q-12-9-8-9t8 1z" fill="#e6a08a" stroke="none" opacity="0.85" />

      {/* 脚边被踩过的雪：两三笔 */}
      <g fill="#f2d3c6" stroke="none" opacity="0.7">
        <ellipse cx="60" cy="182" rx="5" ry="2.2" />
        <ellipse cx="104" cy="186" rx="5" ry="2.2" />
        <ellipse cx="176" cy="184" rx="5" ry="2.2" />
      </g>
    </svg>
  )
}
