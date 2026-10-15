/**
 * 整站边缘装饰
 *
 * 各个页面的内容都居中、四周留白很大，看久了会觉得四周太空。
 * 这里在**屏幕边缘往里一圈**铺一层极淡的信纸纹样：一圈细虚框，
 * 加两枚小图案（左下信封、右下邮戳）和两条竖向虚线。
 *
 * 几个原则：
 *   · 只做线条，不填色，不抢内容 → 保持简约
 *   · fixed 覆盖层，pointer-events-none，不影响任何交互
 *   · z-40，低于弹窗（弹窗都是 z-50 以上），所以不会盖住对话框
 *   · 小屏（< lg）不显示，手机上留白本来就少
 *   · 想整体调淡/去掉，只改这个文件
 */

export function PageDecor() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-40 hidden select-none lg:block"
    >
      {/* 纸边：离屏幕边一点点的一圈细虚线 */}
      <div className="absolute inset-4 rounded-[30px] border border-dashed border-[#eedbc8]" />

      {/* 两条竖向虚线：像信纸的边线 */}
      <span className="absolute left-4 top-1/2 h-32 w-px -translate-y-1/2 border-l border-dashed border-[#eddcc8]" />
      <span className="absolute right-4 top-1/2 h-32 w-px -translate-y-1/2 border-l border-dashed border-[#eddcc8]" />

      {/* 左下：一枚小信封 */}
      <svg
        className="absolute bottom-9 left-10 h-10 w-10 text-[#e8cdb5]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2.5" y="6" width="19" height="12.5" rx="2" />
        <path d="M3.4 7 12 13.2 20.6 7" />
      </svg>

      {/* 右下：一枚小邮戳 */}
      <svg
        className="absolute bottom-9 right-10 h-11 w-11 text-[#e8cdb5]"
        viewBox="0 0 32 32"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      >
        <circle cx="14" cy="18" r="9" />
        <circle cx="14" cy="18" r="6" opacity="0.7" />
        <path d="M10 16.5h8" opacity="0.7" />
        <path d="M11.5 20.5h5" opacity="0.7" />
        <path d="M25 12.5c1.6 0 2.6 1 2.6 2.4" />
        <path d="M25 17.5c1.6 0 2.6 1 2.6 2.4" />
        <path d="M25 22.5c1.6 0 2.6 1 2.6 2.4" />
      </svg>
    </div>
  )
}
