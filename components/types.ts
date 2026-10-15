/* ==================== 数据库表类型 ==================== */

/** profiles 表：首页只需要这三个字段 */
export type ProfileLite = {
  username: string | null
  nickname: string | null
  avatar_url: string | null
}

/** friendships 表 + 关联 profiles 的联表结果 */
export type FriendshipRow = {
  id: string
  requester_id: string
  /** 外键方向不同时 Supabase 可能返回数组，故用归一化函数处理 */
  profiles: ProfileLite | ProfileLite[] | null
}

/* ==================== 视图模型 ==================== */

/** 首页"新招呼"横幅使用的视图模型 */
export type FriendRequest = {
  friendship_id: string
  requester_id: string
  username: string
  nickname: string | null
  avatar_url: string | null
}

/** 登录天数：注册天数与最近一次登录的展示数据 */
export type LoginStreak = {
  days: number
  sinceLast: number
}

/* ==================== 导航卡片 ==================== */

export type NavSection = {
  href: string
  title: string
  desc: string
  /** 下面这几个是"卡片网格"时代的字段，改成可选：
   *  首页已经换成清单式排版，不再需要图标/渐变/配色/标签。
   *  留着可选，是为了别的地方想用还能用。 */
  Icon?: (props: { className?: string }) => React.ReactElement
  gradient?: string
  accent?: string
  tag?: string
}
