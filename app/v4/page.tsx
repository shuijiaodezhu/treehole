'use client'

import { HomeV4 } from '../../components/home-v4'

/**
 * /v4 —— 电脑版首页（液态玻璃 + 深色窄栏）
 *
 * 这个界面现在也是真正的 `/`（宽屏时走它，见 app/page.tsx）。
 * 这条路由留着当直链用：功能区的「← 回院子」、老书签都还指着 /v4。
 */
export default function V4Page() {
  return <HomeV4 />
}
