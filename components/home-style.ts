/**
 * 首页样式（个性化里的一个选项）
 *   current —— 现在的版本（默认）
 *   classic —— 最初那版，用得最久的那一版
 *
 * 只存在浏览器本地：这是"每个人自己喜欢什么"，不是账号资料，
 * 所以不进数据库（换设备会回到默认，这是有意的）。
 */
export const HOME_STYLE_KEY = 'treehole:home-style'

export type HomeStyle = 'current' | 'classic'

export const HOME_STYLES: { value: HomeStyle; label: string; desc: string }[] = [
  { value: 'current', label: '当前版本', desc: '毛笔标题、卡片、引言与信箱' },
  { value: 'classic', label: '经典版本', desc: '最初那版：左栏三张卡 + 四张彩色卡' },
]

export function readHomeStyle(): HomeStyle {
  try {
    const saved = window.localStorage.getItem(HOME_STYLE_KEY)
    if (saved === 'classic' || saved === 'current') return saved
  } catch {
    /* 忽略 */
  }
  return 'current'
}

export function writeHomeStyle(style: HomeStyle): void {
  try {
    window.localStorage.setItem(HOME_STYLE_KEY, style)
    // 通知正在看的页面立刻换版（useSyncExternalStore 订阅的就是这个事件）
    window.dispatchEvent(new Event(HOME_STYLE_KEY))
  } catch {
    /* 忽略 */
  }
}
