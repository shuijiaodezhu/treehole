/**
 * 内容防线：速率限制 + 敏感词
 *
 * ① 速率限制（防刷屏、灌水）
 *    客户端这一层能挡住手快连点、误发、以及绝大多数普通刷屏；
 *    **但它挡不住脚本** —— 抓包直接调接口就绕过去了。
 *    真正的防线是数据库触发器，见仓库根目录 supabase-security.sql。
 *    两层都在：这里给即时反馈（用户马上看到「慢一点」），
 *    数据库那层兜底（脚本也逃不掉）。
 *
 * ② 敏感词
 *    命中就替换成等长的 *，并在界面上说明「已自动替换」——
 *    不静默改动用户的话，也不直接拦下不让他发。
 *
 * 词表是**起始清单**，按需要增删即可；只在这里维护一份，两边都引用。
 */

/* ==================== ② 敏感词 ==================== */

/**
 * 起始词表。加词直接往数组里加，不要写进别的文件。
 * 只放「几乎不可能有正当语境」的词；有歧义的词（比如地名、正常词汇）不要放，
 * 否则会误伤，用户会比你更烦。
 */
const SENSITIVE_WORDS: string[] = [
  // 辱骂（挑最直白的几个，其余按需补）
  '傻逼',
  '沙雕',
  '脑残',
  '废物',
  '滚出去',
  '去死',
  // 广告与引流
  '加微信',
  '加V信',
  '微信号',
  '扫码进群',
  '免费领取',
  '代刷',
  '刷单',
  '兼职日结',
  '博彩',
  '赌博',
  '贷款秒批',
  // 违法
  '毒品',
  '枪支',
]

export type TextFilterResult = {
  /** 处理后的文本 */
  text: string
  /** 命中的词（去重） */
  hits: string[]
}

/** 把命中的敏感词替换成等长的 *，并回报名中哪些词 */
export function filterText(input: string): TextFilterResult {
  let out = input
  const hits: string[] = []
  for (const word of SENSITIVE_WORDS) {
    if (!word) continue
    if (out.includes(word)) {
      hits.push(word)
      out = out.split(word).join('*'.repeat(word.length))
    }
  }
  return { text: out, hits }
}

/** 给界面用的一句话提示 */
export function filterHint(hits: string[]): string {
  if (hits.length === 0) return ''
  return `已自动替换敏感词：${hits.join('、')}`
}

/* ==================== ① 速率限制 ==================== */

export type RateKind = 'message' | 'mailbox' | 'post' | 'comment'

type Rule = {
  /** 两次之间至少间隔多久 */
  minGapMs: number
  /** 窗口长度与窗口内上限 */
  windowMs: number
  max: number
  label: string
}

const RULES: Record<RateKind, Rule> = {
  message: { minGapMs: 700, windowMs: 60_000, max: 20, label: '私信' },
  mailbox: { minGapMs: 3_000, windowMs: 600_000, max: 10, label: '写信' },
  post: { minGapMs: 20_000, windowMs: 600_000, max: 8, label: '发布' },
  comment: { minGapMs: 3_000, windowMs: 300_000, max: 20, label: '评论' },
}

const RATE_KEY = (kind: RateKind) => `treehole:rate:${kind}`

function readStamps(kind: RateKind): number[] {
  try {
    const raw = window.localStorage.getItem(RATE_KEY(kind))
    if (!raw) return []
    const list = JSON.parse(raw) as unknown
    if (!Array.isArray(list)) return []
    return list.filter((n): n is number => typeof n === 'number')
  } catch {
    return []
  }
}

function writeStamps(kind: RateKind, stamps: number[]): void {
  try {
    window.localStorage.setItem(RATE_KEY(kind), JSON.stringify(stamps))
  } catch {
    /* 隐私模式忽略 */
  }
}

export type RateCheck = { ok: true } | { ok: false; message: string; retryAfterMs: number }

/** 发送/发布前先问一句能不能发 */
export function checkRate(kind: RateKind): RateCheck {
  const rule = RULES[kind]
  const now = Date.now()
  const recent = readStamps(kind).filter((t) => now - t < rule.windowMs)

  const last = recent.length > 0 ? Math.max(...recent) : 0
  const sinceLast = now - last
  if (sinceLast < rule.minGapMs) {
    const wait = Math.ceil((rule.minGapMs - sinceLast) / 1000)
    return {
      ok: false,
      message: `慢一点，${wait} 秒后再${rule.label}`,
      retryAfterMs: rule.minGapMs - sinceLast,
    }
  }

  if (recent.length >= rule.max) {
    const oldest = Math.min(...recent)
    const waitMs = rule.windowMs - (now - oldest)
    const wait = Math.max(1, Math.ceil(waitMs / 60000))
    return {
      ok: false,
      message: `${rule.label}太频繁了，${wait} 分钟后再试`,
      retryAfterMs: waitMs,
    }
  }

  return { ok: true }
}

/** 发送/发布成功后记一笔 */
export function noteSent(kind: RateKind): void {
  const rule = RULES[kind]
  const now = Date.now()
  const recent = readStamps(kind).filter((t) => now - t < rule.windowMs)
  recent.push(now)
  writeStamps(kind, recent)
}
