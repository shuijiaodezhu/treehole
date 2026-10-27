'use client'

import Link from 'next/link'

/**
 * /v3 —— 第三版试验页（"一封信"版）
 *
 * 设计约束（先立规矩，再画）：
 *   ① 图案：信纸的**横线**（整页就是一张纸，不是卡片堆 ✗）
 *   ② 材质：纸的暖白 + 火漆印章
 *   ③ 角：右上角**折角**（信封口），不用圆角 ✗
 *   ④ 禁忌：无渐变光晕、无大数字看板、无彩色竖条、无圆角卡片
 *
 * 这一版是**静态预览**（数据写死），只用来看版面。
 * 确认方向后再接真数据。
 */

const PAPER = '#faf5ea'
const INK = '#2f2620'
const INK2 = '#6b5c4e'
const INK3 = '#9c8b78'
const RULE = '#e6dbc6'
const WAX = '#a8452e'
const WAX_DEEP = '#8c3624'

export default function V3Page() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: PAPER }}>
      {/* 整页铺信纸横线（很淡，30px 一行）*/}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(to bottom, transparent 0px, transparent 29px, ${RULE} 29px, ${RULE} 30px)`,
          opacity: 0.55,
          zIndex: 0,
        }}
      />
      {/* 左侧一条竖线，像信纸的装订边 */}
      <div
        aria-hidden
        className="pointer-events-none fixed bottom-0 left-[22px] top-0 w-px"
        style={{ backgroundColor: 'rgba(168,69,46,.18)', zIndex: 0 }}
      />

      <main className="relative mx-auto w-full max-w-[420px] px-7 pb-24 pt-7" style={{ zIndex: 1 }}>
        {/* ── 抬头（右上角折角）── */}
        <header className="relative pb-4">
          {/* 折角：一个三角，颜色比纸略深，带一道折痕线 */}
          <div
            aria-hidden
            className="absolute -right-7 -top-7 h-16 w-16"
            style={{
              background: `linear-gradient(225deg, ${PAPER} 0 49%, #efe4d0 50% 100%)`,
              borderLeft: '1px solid rgba(168,69,46,.16)',
              borderBottom: '1px solid rgba(168,69,46,.16)',
            }}
          />

          <div className="flex items-end justify-between">
            <div>
              <div className="font-serif-cn text-[19px] font-semibold tracking-[0.02em]" style={{ color: INK }}>
                你的来信
              </div>
              <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.22em]" style={{ color: INK3 }}>
                Dear You
              </div>
            </div>
            <nav className="flex items-end gap-4 text-[12.5px] tracking-[0.02em]" style={{ color: INK3 }}>
              <span className="relative pb-1" style={{ color: WAX }}>
                大厅
                <span
                  aria-hidden
                  className="absolute -bottom-0.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full"
                  style={{ backgroundColor: WAX }}
                />
              </span>
              <Link href="/friends" className="pb-1">
                小屋
              </Link>
              <Link href="/me" className="pb-1">
                我的
              </Link>
            </nav>
          </div>
        </header>

        {/* ── 开篇：像一封信的开头（没有色块）── */}
        <section className="pt-3">
          <p className="font-mono text-[8px] uppercase tracking-[0.22em]" style={{ color: INK3 }}>
            杭州 · 15:54 · 18° 小雨
          </p>
          <h1 className="mt-2 font-serif-cn text-[24px] font-semibold leading-[1.5]" style={{ color: INK }}>
            外面在下小雨。
          </h1>
          <p className="mt-1 font-serif-cn text-[13px]" style={{ color: INK2 }}>
            你那边呢？
          </p>

          <div className="mt-4 flex items-center justify-between">
            <Link
              href="/world"
              className="font-serif-cn text-[12.5px]"
              style={{ color: WAX, borderBottom: `1px solid ${WAX}` }}
            >
              进大厅
            </Link>
            <span className="font-serif-cn text-[10px]" style={{ color: INK3 }}>
              今天 12 句新话
            </span>
          </div>
        </section>

        {/* ── 一条引用：用竖线，不用卡片 ── */}
        <section className="mt-7 border-l pl-3.5" style={{ borderColor: 'rgba(168,69,46,.25)' }}>
          <p className="font-serif-cn text-[12.5px] leading-[1.85]" style={{ color: INK2 }}>
            写到这里突然不想写了。但想到会有人看到，就还是发出去了。
          </p>
          <div className="mt-2 flex gap-4 font-mono text-[8px]" style={{ color: INK3 }}>
            <span>23 分钟前</span>
            <span>♡ 12</span>
          </div>
        </section>

        {/* ── 两个入口：不是圆角卡，是两行带箭头的字 ── */}
        <section className="mt-7">
          <div className="flex items-baseline justify-between py-3" style={{ borderTop: `1px solid ${RULE}` }}>
            <div>
              <span className="font-serif-cn text-[14px]" style={{ color: INK }}>
                聚会
              </span>
              <span className="ml-2 font-serif-cn text-[10.5px]" style={{ color: INK3 }}>
                活动、小工具、一起听歌
              </span>
            </div>
            <span className="font-mono text-[11px]" style={{ color: WAX }}>
              →
            </span>
          </div>
          <div className="flex items-baseline justify-between py-3" style={{ borderTop: `1px solid ${RULE}` }}>
            <div>
              <span className="font-serif-cn text-[14px]" style={{ color: INK }}>
                分类
              </span>
              <span className="ml-2 font-serif-cn text-[10.5px]" style={{ color: INK3 }}>
                游戏 / 音乐 / 吃喝 / 压抑 / 旅游
              </span>
            </div>
            <span className="font-mono text-[11px]" style={{ color: WAX }}>
              →
            </span>
          </div>
        </section>

        {/* ── 两个数字，融进一句话里 ── */}
        <section className="mt-6">
          <p className="font-serif-cn text-[11px] leading-[1.9]" style={{ color: INK3 }}>
            陪伴你的第 <span style={{ color: INK2 }}>42</span> 天，写下过{' '}
            <span style={{ color: INK2 }}>7</span> 句话。
          </p>
        </section>

        {/* ── 今天在听 ── */}
        <section className="mt-5" style={{ borderTop: `1px solid ${RULE}`, paddingTop: 14 }}>
          <p className="font-serif-cn text-[11px] leading-[1.9]" style={{ color: INK2 }}>
            <span style={{ color: WAX }}>♪</span> 今天有人在听《我不配》
          </p>
          <p className="mt-0.5 font-serif-cn text-[10.5px]" style={{ color: INK3 }}>
            不用配得上谁，才被允许留下。
          </p>
        </section>

        {/* ── 火漆（唯一一处重色）── */}
        <section className="mt-10 flex items-center justify-center">
          <div
            className="grid h-14 w-14 place-items-center"
            style={{
              borderRadius: '50%',
              backgroundColor: WAX,
              boxShadow: `inset 0 -2px 4px ${WAX_DEEP}, 0 1px 3px rgba(79,45,30,.25)`,
            }}
          >
            <span className="font-serif-cn text-[11px] font-semibold tracking-[0.14em] text-[#fdf6ea]">来信</span>
          </div>
        </section>

        <p className="mt-6 text-center font-serif-cn text-[9.5px]" style={{ color: INK3 }}>
          这是第三版试验页 /v3 · 只有这一版不要圆角和光晕
        </p>
      </main>
    </div>
  )
}
