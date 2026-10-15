/**
 * 路由切换时的进场动效
 *
 * template.tsx 每次导航都会重新挂载，所以动画会重放一次；
 * 纯 CSS，不引入动画库。尊重系统的「减少动态效果」（见 globals.css）。
 */

export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in">{children}</div>
}
