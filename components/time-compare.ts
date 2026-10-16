/**
 * 时间比较：一律按**时间戳**比，不按字符串比
 *
 * 背景（真事故）：本机写的是 "…Z"，数据库来的是 "…+00:00"
 *   字符串比较时 '+' 小于 'Z' → 更新的那个反而算"更旧"
 *   → 未读角标在看过的消息上又冒出来
 */

/** a 是否**晚于** b（解析不了的一律保守处理） */
export function isAfter(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a) return false
  if (!b) return true
  const ta = Date.parse(a)
  const tb = Date.parse(b)
  if (Number.isNaN(ta)) return false
  if (Number.isNaN(tb)) return true
  return ta > tb
}

/** 取较新的那个（任一个为空就返回另一个） */
export function newest(
  a: string | null | undefined,
  b: string | null | undefined,
): string | null {
  if (!a) return b ?? null
  if (!b) return a
  return isAfter(a, b) ? a : b
}
