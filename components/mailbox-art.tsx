'use client'

/**
 * 冬日信箱的插图
 *
 * 造型是 3/4 视角的信箱，靠三个面做出纵深：
 *   正面 accent-soft（最浅）→ 顶面 accent-light（中调）→ 右侧面 accent 半透明（最深）
 * 再叠上屋脊的雪、门缝里透出的暖光和露出的一角信、翘起的小旗、
 * 立柱与地面投影；雪点分两层（远的小而淡、近的大而实）拉开前后景。
 *
 * 全部用页面的主色变量，所以跟着「页面配色」一起变，不会自成一套颜色。
 */

export function MailboxArt({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="打开冬日信箱"
      className="group block w-full text-left"
    >
      <svg
        viewBox="0 0 215 255"
        className="w-full transition-transform duration-500 group-hover:-translate-y-1"
        aria-hidden="true"
      >
        {/* ---------- 远景雪（小而淡） ---------- */}
        <g fill="var(--accent-light)" opacity="0.45">
          <circle cx="34" cy="26" r="2.4" />
          <circle cx="84" cy="14" r="2" />
          <circle cx="158" cy="36" r="2.2" />
          <circle cx="196" cy="104" r="2" />
          <circle cx="12" cy="116" r="2.2" />
          <circle cx="54" cy="150" r="1.8" />
        </g>

        {/* ---------- 雪地 + 立柱投影 ---------- */}
        <ellipse cx="106" cy="232" rx="106" ry="16" fill="var(--accent-soft)" />
        <ellipse cx="108" cy="239" rx="88" ry="15" fill="var(--accent-soft)" opacity="0.85" />
        <ellipse cx="90" cy="224" rx="26" ry="8" fill="var(--accent-line)" opacity="0.8" />

        {/* ---------- 立柱 ---------- */}
        <path
          d="M78 168 H96 L94 224 H80 Z"
          fill="var(--accent-soft)"
          stroke="var(--accent-line)"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path d="M88 168 H96 L94 224 H88 Z" fill="var(--accent-line)" />

        {/* ---------- 顶面（两个拱之间那条弯带 = 纵深） ---------- */}
        <path d="M40 120 A45 45 0 0 1 130 120 L156 107 A45 45 0 0 0 66 107 Z" fill="var(--accent-light)" />

        {/* ---------- 右侧面（最深） ---------- */}
        <path
          d="M130 120 L156 107 L156 150 L130 163 Z"
          fill="var(--accent)"
          fillOpacity="0.55"
          stroke="var(--accent)"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />

        {/* ---------- 正面（最浅） ---------- */}
        <path
          d="M40 120 A45 45 0 0 1 130 120 L130 163 L48 163 L40 152 Z"
          fill="var(--accent-soft)"
          stroke="var(--accent)"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />

        {/* ---------- 门 ---------- */}
        <rect
          x="48"
          y="124"
          width="60"
          height="34"
          rx="3"
          fill="var(--accent-line)"
          fillOpacity="0.55"
          stroke="var(--accent-line)"
          strokeWidth="2"
        />

        {/* 门开了一条缝：暖光 + 露出的信 */}
        <path d="M52 127 H88 V155 H52 Z" fill="var(--accent-light)" fillOpacity="0.5" />
        <g stroke="var(--accent-soft)" strokeWidth="2" strokeLinecap="round">
          <path d="M56 132 H61" />
          <path d="M65 139 H70" />
          <path d="M74 146 H79" />
        </g>
        <path
          d="M58 134 L79 138 L75 155 L54 151 Z"
          fill="var(--accent-soft)"
          stroke="var(--accent-light)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <g stroke="var(--accent-light)" strokeWidth="1.5" strokeLinecap="round">
          <path d="M61 141 L72 143" />
          <path d="M60 147 L69 149" />
        </g>

        {/* 把手 */}
        <circle cx="100" cy="140" r="3" fill="var(--accent)" />

        {/* ---------- 小旗（挂在箱子侧面，旗子翘到箱子之上） ---------- */}
        <path d="M146 150 V98" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M146 98 L170 104 L170 116 L146 110 Z" fill="var(--accent)" />

        {/* ---------- 屋脊上的雪 ---------- */}
        <path
          d="M66 107 A45 45 0 0 1 156 107"
          fill="none"
          stroke="var(--accent-soft)"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* ---------- 飘在左边的一颗心（站主在听） ---------- */}
        <path
          d="M9 84 A6.5 6.5 0 0 1 22 84 A6.5 6.5 0 0 1 35 84 L22 98.6 Z"
          fill="var(--accent)"
          fillOpacity="0.75"
        />

        {/* ---------- 近景雪（大而实） ---------- */}
        <g fill="var(--accent-light)" opacity="0.75">
          <circle cx="20" cy="58" r="6.8" />
          <circle cx="188" cy="150" r="5.6" />
          <circle cx="26" cy="186" r="5.2" />
          <circle cx="174" cy="206" r="5.6" />
        </g>
      </svg>

      <span className="mt-4 block font-serif-cn text-sm font-semibold text-[#2b2620]">冬日信箱</span>
      <span className="mt-1.5 block font-serif-cn text-[11.5px] leading-relaxed text-[var(--accent-muted)]">
        把冬天的心事，
        <br />
        寄给会回信的人。
      </span>
    </button>
  )
}
