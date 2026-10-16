'use client'

import { useEffect, useRef, useState } from 'react'
import { Icon } from './icons'

/**
 * 聚会里的小程序（四个小工具）
 *
 * 之前这四张卡片点下去是 `alert('小程序还在开发中')` —— 摆设。
 * 现在真做了：掷骰子、抛硬币、抽签、随机数，另外共用一个「最近结果」记录。
 *
 * 几个刻意的做法：
 *   · 掷/抛的时候有 400ms 的**快速滚动动画** —— 不是必需，但"点数在跳"这件事
 *     本身让结果更像掷出来的，而不是凭空冒出来
 *   · 结果保留**最近 5 次**，随时可以清掉；不上传、不存云，纯本地
 *   · 抽签和随机数支持**不重复**（抽完为止），抽签的选项一行一个自己填
 *   · 全部只在前端算，不发任何请求 —— 这种东西不该占服务器
 */

type ToolKey = 'dice' | 'coin' | 'pick' | 'random'

type HistoryRow = { at: number; tool: string; result: string }

const TOOLS: { key: ToolKey; name: string; icon: 'dice' | 'coin' | 'target' | 'sparkle'; desc: string }[] = [
  { key: 'dice', name: '掷骰子', icon: 'dice', desc: '1-6，可掷多颗' },
  { key: 'coin', name: '抛硬币', icon: 'coin', desc: '正反，可抛多枚' },
  { key: 'pick', name: '抽签', icon: 'target', desc: '从自己写的选项里抽' },
  { key: 'random', name: '随机数', icon: 'sparkle', desc: '范围内，可要不重复' },
]

/** 滚动动画：这段时间内数字一直跳 */
const ROLL_MS = 400

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function shuffle<T>(list: T[]): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function MiniTools() {
  const [active, setActive] = useState<ToolKey>('dice')
  const [rolling, setRolling] = useState(false)
  const [history, setHistory] = useState<HistoryRow[]>([])
  const timerRef = useRef<number | null>(null)

  /* ---- 掷骰子 ---- */
  const [diceCount, setDiceCount] = useState(2)
  const [dice, setDice] = useState<number[]>([])

  /* ---- 抛硬币 ---- */
  const [coinCount, setCoinCount] = useState(1)
  const [coins, setCoins] = useState<boolean[]>([]) // true = 正

  /* ---- 抽签 ---- */
  const [optionsText, setOptionsText] = useState('吃火锅\n吃烧烤\n点外卖\n随便')
  const [picked, setPicked] = useState<string | null>(null)
  const [pickedHistory, setPickedHistory] = useState<string[]>([])
  const [noRepeatPick, setNoRepeatPick] = useState(false)

  /* ---- 随机数 ---- */
  const [rangeMin, setRangeMin] = useState(1)
  const [rangeMax, setRangeMax] = useState(100)
  const [numberCount, setNumberCount] = useState(1)
  const [noRepeatNumber, setNoRepeatNumber] = useState(true)
  const [numbers, setNumbers] = useState<number[]>([])
  const [numberError, setNumberError] = useState('')

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [])

  function remember(tool: string, result: string) {
    setHistory((prev) => [{ at: Date.now(), tool, result }, ...prev].slice(0, 5))
  }

  /**
   * 摇动动画：这段时间里 onTick 一直刷新（数字看着在跳），
   * 结束后**只算一次**最终结果交给 onFinish —— 显示的和记进历史的必须是同一个值。
   */
  function animate(onTick: () => void, onFinish: () => void) {
    if (rolling) return
    setRolling(true)

    let shown = 0
    timerRef.current = window.setInterval(() => {
      shown += 1
      onTick()
      if (shown * 60 >= ROLL_MS) {
        if (timerRef.current) window.clearInterval(timerRef.current)
        timerRef.current = null
        setRolling(false)
        onFinish()
      }
    }, 60)
  }

  function rollDice() {
    const preview = () => Array.from({ length: diceCount }, () => randomInt(1, 6))
    animate(preview, () => {
      const final = preview()
      setDice(final)
      remember(
        '掷骰子',
        final.length > 1 ? `${final.join(' + ')} = ${final.reduce((a, b) => a + b, 0)}` : `${final[0]}`,
      )
    })
  }

  function flipCoins() {
    const preview = () => Array.from({ length: coinCount }, () => Math.random() < 0.5)
    animate(preview, () => {
      const final = preview()
      setCoins(final)
      const headCount = final.filter(Boolean).length
      remember('抛硬币', `${headCount} 正 · ${final.length - headCount} 反`)
    })
  }

  function pickOne() {
    const options = optionsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    if (options.length === 0) {
      setPicked('先在上面写几个选项')
      return
    }

    let pool = options
    if (noRepeatPick) {
      const left = options.filter((o) => !pickedHistory.includes(o))
      if (left.length === 0) {
        setPickedHistory([])
        pool = options
      } else {
        pool = left
      }
    }

    const winner = pool[randomInt(0, pool.length - 1)]
    setPicked(winner)
    setPickedHistory((prev) => (noRepeatPick ? [...prev, winner] : [winner]))
    if (noRepeatPick) {
      const left = options.filter((o) => o !== winner && !pickedHistory.includes(o))
      remember('抽签', `${winner}（还剩 ${left.length} 个没抽）`)
    } else {
      remember('抽签', winner)
    }
  }

  function rollNumbers() {
    const min = Math.min(rangeMin, rangeMax)
    const max = Math.max(rangeMin, rangeMax)
    const span = max - min + 1

    if (numberCount < 1) {
      setNumberError('个数至少 1 个')
      return
    }
    if (noRepeatNumber && numberCount > span) {
      setNumberError(`${min}~${max} 之间只有 ${span} 个整数，抽不出 ${numberCount} 个不重复的`)
      return
    }

    setNumberError('')
    let value: number[]
    if (noRepeatNumber) {
      value = shuffle(Array.from({ length: span }, (_, i) => min + i)).slice(0, numberCount)
    } else {
      value = Array.from({ length: numberCount }, () => randomInt(min, max))
    }
    setNumbers(value)
    remember('随机数', value.join(' · '))
  }

  const diceTotal = dice.reduce((a, b) => a + b, 0)
  const heads = coins.filter(Boolean).length
  const options = optionsText.split('\n').map((l) => l.trim()).filter(Boolean)

  return (
    <div className="space-y-4">
      {/* 四个入口 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {TOOLS.map((tool) => {
          const on = active === tool.key
          return (
            <button
              key={tool.key}
              type="button"
              onClick={() => setActive(tool.key)}
              className={`rounded-box border p-4 text-left transition-all ${
                on
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-base-300 bg-base-100/90 hover:-translate-y-0.5 hover:shadow-sm'
              }`}
            >
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-box bg-base-100/80">
                <Icon name={tool.icon} className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-semibold text-base-content">{tool.name}</p>
              <p className="mt-0.5 text-[11.5px] text-base-content/60">{tool.desc}</p>
            </button>
          )
        })}
      </div>

      {/* 当前工具 */}
      <div className="rounded-box border border-base-300 bg-base-100/90 p-5 backdrop-blur">
        {active === 'dice' && (
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs text-base-content/60">骰子个数</label>
              <input
                type="range"
                min={1}
                max={6}
                value={diceCount}
                onChange={(e) => setDiceCount(Number(e.target.value))}
                className="accent-primary"
              />
              <span className="text-xs text-base-content">{diceCount} 颗</span>
              <button
                type="button"
                onClick={rollDice}
                disabled={rolling}
                className="ml-auto rounded-box bg-primary px-5 py-2 text-xs font-medium text-primary-content transition hover:shadow-sm disabled:opacity-60"
              >
                {rolling ? '掷…' : '掷'}
              </button>
            </div>

            <div className="mt-5 flex min-h-[72px] flex-wrap items-center justify-center gap-3">
              {dice.length === 0 ? (
                <p className="text-xs text-accent">点「掷」试试</p>
              ) : (
                dice.map((face, i) => (
                  <span
                    key={i}
                    className={`flex h-14 w-14 items-center justify-center rounded-box border text-2xl font-semibold transition ${
                      rolling
                        ? 'border-base-300 bg-primary/5 text-accent'
                        : 'border-primary bg-base-100 text-primary shadow-sm'
                    }`}
                  >
                    {face}
                  </span>
                ))
              )}
            </div>

            {dice.length > 1 && !rolling && (
              <p className="mt-3 text-center text-xs text-base-content/60">
                合计 <span className="font-semibold text-base-content">{diceTotal}</span>
              </p>
            )}
          </div>
        )}

        {active === 'coin' && (
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs text-base-content/60">硬币枚数</label>
              <input
                type="range"
                min={1}
                max={20}
                value={coinCount}
                onChange={(e) => setCoinCount(Number(e.target.value))}
                className="accent-primary"
              />
              <span className="text-xs text-base-content">{coinCount} 枚</span>
              <button
                type="button"
                onClick={flipCoins}
                disabled={rolling}
                className="ml-auto rounded-box bg-primary px-5 py-2 text-xs font-medium text-primary-content transition hover:shadow-sm disabled:opacity-60"
              >
                {rolling ? '抛…' : '抛'}
              </button>
            </div>

            <div className="mt-5 flex min-h-[72px] flex-wrap items-center justify-center gap-2">
              {coins.length === 0 ? (
                <p className="text-xs text-accent">点「抛」试试</p>
              ) : (
                coins.map((isHead, i) => (
                  <span
                    key={i}
                    className={`flex h-11 w-11 items-center justify-center rounded-full border text-[11px] transition ${
                      rolling
                        ? 'border-base-300 bg-primary/5 text-accent'
                        : isHead
                          ? 'border-primary bg-base-100 text-primary'
                          : 'border-base-300 bg-primary/5 text-base-content/60'
                    }`}
                  >
                    {isHead ? '正' : '反'}
                  </span>
                ))
              )}
            </div>

            {coins.length > 0 && !rolling && (
              <p className="mt-3 text-center text-xs text-base-content/60">
                <span className="font-semibold text-base-content">{heads}</span> 正 ·{' '}
                <span className="font-semibold text-base-content">{coins.length - heads}</span> 反
              </p>
            )}
          </div>
        )}

        {active === 'pick' && (
          <div>
            <p className="text-[11.5px] leading-relaxed text-base-content/60">
              一行一个选项。抽签只用在你犹豫的时候——决定了就别再抽了。
            </p>
            <textarea
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              rows={5}
              className="mt-3 w-full rounded-box border border-base-300 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-base-content focus:border-primary focus:outline-none"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-base-content/60">
                <input
                  type="checkbox"
                  checked={noRepeatPick}
                  onChange={(e) => setNoRepeatPick(e.target.checked)}
                  className="h-3.5 w-3.5 accent-primary"
                />
                不重复（抽完自动重新开始）
              </label>
              <span className="text-[11.5px] text-accent">
                共 {options.length} 个
                {noRepeatPick && pickedHistory.length > 0 && ` · 已抽 ${pickedHistory.length}`}
              </span>
              <button
                type="button"
                onClick={pickOne}
                className="ml-auto rounded-box bg-primary px-5 py-2 text-xs font-medium text-primary-content transition hover:shadow-sm"
              >
                抽一个
              </button>
            </div>

            <div className="mt-5 flex min-h-[64px] items-center justify-center">
              {picked ? (
                <p className="rounded-box border border-primary bg-base-100 px-6 py-4 text-xl font-semibold text-primary shadow-sm">
                  {picked}
                </p>
              ) : (
                <p className="text-xs text-accent">还没抽</p>
              )}
            </div>
          </div>
        )}

        {active === 'random' && (
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs text-base-content/60">从</label>
              <input
                type="number"
                value={rangeMin}
                onChange={(e) => setRangeMin(Number(e.target.value))}
                className="w-20 rounded-box border border-base-300 bg-primary/5 px-3 py-1.5 text-xs text-base-content focus:border-primary focus:outline-none"
              />
              <label className="text-xs text-base-content/60">到</label>
              <input
                type="number"
                value={rangeMax}
                onChange={(e) => setRangeMax(Number(e.target.value))}
                className="w-20 rounded-box border border-base-300 bg-primary/5 px-3 py-1.5 text-xs text-base-content focus:border-primary focus:outline-none"
              />
              <label className="text-xs text-base-content/60">取</label>
              <input
                type="number"
                min={1}
                value={numberCount}
                onChange={(e) => setNumberCount(Number(e.target.value))}
                className="w-16 rounded-box border border-base-300 bg-primary/5 px-3 py-1.5 text-xs text-base-content focus:border-primary focus:outline-none"
              />
              <span className="text-xs text-base-content/60">个</span>
              <button
                type="button"
                onClick={rollNumbers}
                className="ml-auto rounded-box bg-primary px-5 py-2 text-xs font-medium text-primary-content transition hover:shadow-sm"
              >
                生成
              </button>
            </div>

            <label className="mt-3 flex cursor-pointer items-center gap-1.5 text-[11px] text-base-content/60">
              <input
                type="checkbox"
                checked={noRepeatNumber}
                onChange={(e) => setNoRepeatNumber(e.target.checked)}
                className="h-3.5 w-3.5 accent-primary"
              />
              不重复
            </label>

            {numberError && (
              <p className="mt-2 text-[11.5px] leading-relaxed text-red-500">{numberError}</p>
            )}

            <div className="mt-5 flex min-h-[64px] flex-wrap items-center justify-center gap-2">
              {numbers.length === 0 ? (
                <p className="text-xs text-accent">点「生成」试试</p>
              ) : (
                numbers.map((n, i) => (
                  <span
                    key={i}
                    className="rounded-box border border-primary bg-base-100 px-4 py-2 text-lg font-semibold text-primary"
                  >
                    {n}
                  </span>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* 最近结果 */}
      {history.length > 0 && (
        <div className="rounded-box border border-base-300 bg-base-100/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11.5px] tracking-wide text-base-content/60">最近结果（只存在这台设备上）</p>
            <button
              type="button"
              onClick={() => setHistory([])}
              className="text-[11.5px] text-accent transition hover:text-red-500"
            >
              清空
            </button>
          </div>
          <ul className="mt-2 space-y-1">
            {history.map((row) => (
              <li key={row.at} className="flex items-center gap-2 text-[11px]">
                <span className="text-accent">{row.tool}</span>
                <span className="min-w-0 flex-1 truncate text-base-content">{row.result}</span>
                <span className="flex-shrink-0 text-[11px] text-accent">
                  {new Date(row.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
