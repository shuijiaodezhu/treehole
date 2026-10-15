import { AppLoading } from '../components/login-handoff'

/**
 * 路由段加载时的首屏动画
 *
 * 具体画面与「刚登录完不显示」的判断都在 components/login-handoff.tsx，
 * 这里只做入口。
 */
export default function Loading() {
  return <AppLoading />
}
