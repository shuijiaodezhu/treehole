import { redirect } from 'next/navigation'

/**
 * 老地址 /v4：这一版已经是正式版了（电脑首页就是它），
 * 这条路由只负责把人和老书签送回 `/`。
 */
export default function V4Page() {
  redirect('/')
}
