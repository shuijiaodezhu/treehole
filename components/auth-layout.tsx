import Link from 'next/link'

/**
 * 登录 / 注册页的共用外壳
 *
 * 之前左边文字是 absolute left-20、卡片是 lg:mr-32，各自贴边，
 * 大屏上中间会空出一大片。改成居中的两栏，间距固定，两块挨在一起。
 *
 * 简约装饰（都在大屏显示，小屏收起）：
 *   · 外层细虚框：把左右两块收进同一张「信纸」里
 *   · 中间一条竖向虚线，正中点一枚小圆点（像火漆印）
 *   · 品牌区下方一条细线 + 一个小信封图标 + 一段虚线
 */

export function AuthLayout({
  heading,
  subheading,
  children,
}: {
  heading: string
  subheading: string
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--paper)] px-6 py-12">
      {/* 背景光晕 */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-[#f0b078] opacity-20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-[#d97757] opacity-10 blur-3xl" />

      <div className="relative w-fit max-w-full">
        {/* 外层细虚框：贴着内容，不按容器宽度撑开 */}
        <div className="pointer-events-none absolute -inset-6 hidden rounded-[44px] border border-dashed border-[#f2ddcc] lg:block" />

        <div className="animate-fade-up relative flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:justify-center lg:gap-14">
          {/* 左：品牌 */}
          <div className="hidden w-[300px] flex-shrink-0 lg:block">
            <h1 className="font-serif-cn text-5xl font-bold leading-tight tracking-wide text-[#2b2620]">
              你的来信
            </h1>
            <p className="mt-3 font-art text-3xl text-[#c96447]">Dear You</p>
            <p className="mt-6 text-sm leading-relaxed text-[#8a827a]">
              这里有一封，你的来信。
              <br />
              陌生人、朋友，和自己。
            </p>

            {/* 细线 + 小信封 + 虚线：把空白填得有呼吸感，又不多 */
            }
            <div className="mt-9 flex items-center gap-3">
              <span className="h-px w-8 bg-[#e8c8b5]" />
              <svg
                className="h-4 w-4 flex-shrink-0 text-[#dfa88c]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <rect x="2.5" y="6" width="19" height="12.5" rx="2" />
                <path d="M3.4 7 12 13.2 20.6 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="h-px flex-1 border-t border-dashed border-[#f0dcc9]" />
            </div>
          </div>

          {/* 中：竖向虚线 + 小圆点 */}
          <div className="relative hidden w-px self-stretch lg:block">
            <span className="absolute inset-y-3 left-0 w-px border-l border-dashed border-[#f0dcc9]" />
            <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f0dcc9]" />
          </div>

          {/* 右：表单卡片 */}
          <div className="w-full max-w-sm flex-shrink-0">
            <div className="rounded-3xl border border-[#f0e4d4] bg-white/80 p-8 shadow-[0_8px_40px_rgba(217,119,87,0.08)] backdrop-blur-lg">
              {/* 小屏时品牌放在卡片里 */}
              <div className="mb-6 text-center lg:hidden">
                <h1 className="text-2xl font-bold text-[#2b2620]">你的来信</h1>
                <p className="mt-1 font-art italic text-[#c96447]">Dear You</p>
              </div>

              <h2 className="mb-1 hidden text-lg font-semibold text-[#2b2620] lg:block">{heading}</h2>
              <p className="mb-6 hidden text-xs text-[#8a827a] lg:block">{subheading}</p>

              {children}
            </div>

            <p className="mt-4 text-center text-[10px] tracking-wider text-[#b0a89e]">
              © 你的来信 · Dear You
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** 表单里那句「去注册 / 去登录」，两个页面样式一致 */
export function AuthSwitch({ text, href, label }: { text: string; href: string; label: string }) {
  return (
    <div className="mt-6 text-center">
      <p className="text-xs text-[#8a827a]">
        {text}
        <Link href={href} className="ml-1 font-medium text-[#c96447] hover:underline">
          {label}
        </Link>
      </p>
    </div>
  )
}
