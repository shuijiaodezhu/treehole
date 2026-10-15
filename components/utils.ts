/** 站主 uid：后台权限判断与「冬日信箱」的收件人都是它 */
export const ADMIN_UUID = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'

import type { ProfileLite, FriendshipRow, LoginStreak } from './types'

/* ==================== 常量 ==================== */

/** 每日一句的切换周期：2 小时一个时间片 */
export const QUOTE_SLOT_MS = 1000 * 60 * 60 * 2

/** 天气降级时使用的默认地点 */
export const DEFAULT_CITY = '徐州'
export const DEFAULT_LAT = 34.26
export const DEFAULT_LON = 117.19

/* ==================== 每日一句 ==================== */

const DAILY_QUOTES = [
  "今天也要好好吃饭啊。","慢一点，没关系。","有人在乎你。","今天辛苦了。","明天会好一点。","记得多喝水。","想休息就休息吧。","不用什么都做对。","有人在等你的消息。","天冷了，记得穿厚一点。",
  "今天有没有笑过？","不开心可以不说。","你已经很棒了。","累了就停下来。","不用急着长大。","今天有好好呼吸吗。","给自己一个拥抱。","不用成为别人。","做自己就很好。","允许自己难过。",
  "雨停了，天会晴。","今天也是限量版。","有人在偷偷想你。","你不需要被所有人喜欢。","慢一点，世界不会跑。","吃块糖吧，会好一点。","今天早点睡。","别对自己太苛刻。","难过是可以的。","你已经很努力了。",
  "有情绪是正常的。","不用假装开心。","你不孤单。","明天见。","今天要平安。","记得吃早餐。","别熬夜了。","给自己买束花。","想哭就哭吧。","别把委屈憋着。",
  "出门看看太阳。","今天的风很温柔。","放下手机，发会呆。","你可以慢一点。","别太用力。","允许自己偷懒。","今天不用那么完美。","先照顾自己。","别委屈了自己。","你值得被爱。",
  "会有好事的。","要相信光会来。","今天也谢谢你。","别想太多。","喝口热水。","伸个懒腰。","看看窗外。","你很重要。","你被需要。","你很好。",
  "安静一点，也没关系。","不用解释。","你今天也可以。","想说什么就说吧。","写下来，就不算憋着。","把心里的石头放下。","不着急，慢慢来。","你已经做得很好了。","深呼吸，会好一点。","今天也别忘了吃饭。",
  "天冷加衣。","心情不好就休息。","睡一觉，会好的。","你被想念着。","有人为你留了灯。","回家的路上注意安全。","今天有星星吗。","抬头看看天空。","月亮今晚很好看。","别怕，会过去。",
  "会好起来的。","你需要休息。","不用撑那么久。","可以脆弱一点。","没人要求你坚强。","偶尔躺平也可以。","你今天已经够好了。","别和别人比。","你不是在浪费时间。","你只是需要时间。",
  "慢慢走也没关系。","太阳每天都会升起。","给自己一点耐心。","难过的时候，来找我们说说话。","我们都在。","有人记得你喜欢什么。","今天也谢谢你还在。","谢谢你没有放弃。","谢谢你还在坚持。","今天也有人在想你。",
  "你写下的每一句都有人看。","你不是一个人。","这里有人陪着你。","想说什么都可以。","这里不会评判你。","你可以做自己。","不用担心被讨厌。","你是被欢迎的。","慢慢说，我们都在听。","你今天感觉怎么样？",
  "如果难受，就写在院子里。","把秘密讲给陌生人听。","说出去了就不算秘密。","不用担心丢脸。","每个人都有自己的不容易。","你承受的，别人也经历过。","会有人懂你的。","会有懂你的人出现。","慢慢等。","好的事情值得等。",
  "别急，花总会开。","你也是。","属于你的季节还没来。","慢慢等风来。","给自己时间。","有些事急不来。","日子一天天过。","今天也是新的一天。","明天也值得期待。","会有好事发生的。",
  "你会好起来的。","明天也会有太阳。","记得抬头看月亮。","今天的你很好看。","笑一笑。","今天穿得暖暖的。","记得抹护手霜。","头发乱了也没关系。","今天不用那么用力。","可以偷一下懒。",
  "今天也可以什么都不做。","发呆也是正经事。","允许自己无所事事。","安静地待一会儿。","给自己泡杯茶。","吃块小饼干。","想吃什么就去吃。","今天想见谁？","记得联系一下老朋友。","给妈妈打个电话。",
  "给爸爸发个消息。","和家人聊聊天。","有人一直在等你。","有人在担心你。","你今天有好好照顾自己吗。","记得好好休息。","身体最重要。","健康比什么都重要。","先照顾好自己。","然后再去照顾别人。",
  "你是值得被爱的。","你值得一切美好。","你值得拥有开心。","你值得被好好对待。","你值得被温柔以待。","你值得更好的人生。","你值得拥有你喜欢的一切。","你值得拥有平静。","你值得拥有安宁。","你值得拥有幸福。",
  "你值得拥有爱。","你值得被理解。","你值得被接纳。","你值得被看见。","你值得被听见。","你值得被珍惜。","你值得被记住。","你值得被想念。","你值得被等待。","你值得被期待。",
  "你值得被信任。","你值得被尊重。","你值得被支持。","你值得被鼓励。","你值得被陪伴。",
]

/** 2 小时一个时间片，全站同刻同句 */
export function getQuoteByTime(now: number = Date.now()): string {
  const slot = Math.floor(now / QUOTE_SLOT_MS) % DAILY_QUOTES.length
  return DAILY_QUOTES[slot]
}

/** 距离下一个时间片还有多少毫秒（至少 1 秒，防止 0 延迟定时器） */
/**
 * 一天一首小诗：按日期取 count 句，同一天内稳定不变。
 * 信里写的不该只有一句话 —— 三四句连起来才像一个人在那儿慢慢说。
 * 步长取 7，避免取到相邻两句（那两句常常太像）。
 */
export function getDailyPoem(count = 3, now: number = Date.now()): string[] {
  const n = DAILY_QUOTES.length
  const day = Math.floor(now / (1000 * 60 * 60 * 24))
  const start = day % n
  const out: string[] = []
  for (let i = 0; i < count && i < n; i++) {
    out.push(DAILY_QUOTES[(start + i * 7) % n])
  }
  return out
}

export function msUntilNextQuoteSlot(now: number = Date.now()): number {
  return Math.max(Math.ceil(now / QUOTE_SLOT_MS) * QUOTE_SLOT_MS - now, 1000)
}

/* ==================== 日期格式化（Intl） ==================== */

const dateFmt = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' })
const weekdayFmt = new Intl.DateTimeFormat('zh-CN', { weekday: 'long' })

/** 例：10月15日 星期三 */
export function formatDateText(date: Date = new Date()): string {
  return `${dateFmt.format(date)} ${weekdayFmt.format(date)}`
}

/* ==================== 登录天数 ==================== */

/** 用 UTC 零点相减，避免时区导致少算一天；首日算 1 天 */
function daysBetween(fromISO: string, to: Date): number | null {
  const from = new Date(fromISO)
  if (Number.isNaN(from.getTime())) return null
  const startFrom = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const startTo = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.floor((startTo - startFrom) / 86400000) + 1
}

export function calcLoginStreak(createdAt?: string | null, lastSignInAt?: string | null): LoginStreak {
  const now = new Date()
  const days = (createdAt ? daysBetween(createdAt, now) : null) ?? 1
  return {
    days: Math.max(days, 1),
    sinceLast: (lastSignInAt ? daysBetween(lastSignInAt, now) : null) ?? 1,
  }
}

/* ==================== Supabase 联表结果归一化 ==================== */

/** 同一段联表查询可能返回对象或数组，统一取第一个 */
export function pickProfile(input: FriendshipRow['profiles']): ProfileLite | null {
  if (!input) return null
  if (Array.isArray(input)) return input[0] ?? null
  return input
}

/** 昵称优先，其次用户名，最后兜底 */
export function resolveDisplayName(profile: ProfileLite | null, fallback = '某人'): string {
  const nickname = profile?.nickname?.trim()
  const username = profile?.username?.trim()
  return nickname || username || fallback
}

/** 无头像时的占位字符 */
export function avatarFallback(profile: ProfileLite | null, fallback = '友'): string {
  return resolveDisplayName(profile, fallback).slice(0, 1)
}
