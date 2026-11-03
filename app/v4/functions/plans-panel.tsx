'use client'

import { useState } from 'react'
import {
  KIND_HINT,
  KIND_LABEL,
  KIND_ORDER,
  describeDue,
  usePlans,
  type PlanKind,
} from '@/components/plans'

/**
 * 计划书 · v4 风格面板
 *
 * 只复用 components/plans.ts 的数据层（usePlans / create / update / remove），
 * 界面重新画一遍：纸卡片 + 朱砂强调 + 进度条，跟 /v4 一致。
 */

const KIND_TONE: Record<PlanKind, { dot: string; tag: string }> = {
  plan: { dot: '#b04a2c', tag: '#8d3f2c' },
  goal: { dot: '#d9963f', tag: '#a8712c' },
  task: { dot: '#7d8a5a', tag: '#5f6b42' },
}

export function PlansPanel({ userId }: { userId: string | null }) {
  const plans = usePlans(userId)
  const [kind, setKind] = useState<PlanKind>('task')
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [msg, setMsg] = useState('')

  const submit = async () => {
    if (!title.trim()) {
      setMsg('写点什么再保存')
      return
    }
    const r = await plans.create({
      kind,
      title: title.trim(),
      dueDate: due || null,
    })
    if (r.ok) {
      setTitle('')
      setDue('')
      setMsg('')
    } else {
      setMsg(r.message ?? '保存失败')
    }
  }

  const list = plans.items ?? []

  return (
    <div className={"pl-wrap"}>
      {/* 新建 */}
      <section className={"pl-card pl-new v4-glass"}>
        <div className={"pl-newHead"}>
          <span className={"pl-title"}>记一条</span>
          <div className={"pl-kinds"}>
            {KIND_ORDER.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={'pl-kind' + (kind === k ? ' pl-kindOn' : '')}
              >
                <i className={"pl-dot"} style={{ background: KIND_TONE[k].dot }} />
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
        <p className={"pl-hint"}>{KIND_HINT[kind]}</p>
        <div className={"pl-row"}>
          <input
            className={"pl-input pl-inputGrow"}
            value={title}
            placeholder={
              kind === 'plan' ? '比如：十一月把书架整理完' : kind === 'goal' ? '比如：读完 12 本书' : '比如：预约体检'
            }
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit()
            }}
          />
          <input
            className={"pl-input"}
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            aria-label="截止日期"
          />
          <button type="button" className={"pl-save"} onClick={() => void submit()} disabled={plans.busy}>
            {plans.busy ? '保存中…' : '记下'}
          </button>
        </div>
        {msg && <p className={"pl-err"}>{msg}</p>}
        {plans.error && <p className={"pl-err"}>{plans.error}</p>}
      </section>

      {/* 统计 */}
      <section className={"pl-stats"}>
        <div className={"pl-stat v4-glass"}>
          <b>{plans.stats.openTasks}</b>
          <span>待办</span>
        </div>
        <div className={"pl-stat v4-glass"}>
          <b>{plans.stats.doneTasks}</b>
          <span>已完成</span>
        </div>
        <div className={"pl-stat v4-glass"}>
          <b>{plans.stats.goalProgress}%</b>
          <span>{plans.stats.goals} 个目标</span>
        </div>
      </section>

      {/* 列表 */}
      <section className={"pl-list"}>
        {plans.loading ? (
          <p className={"pl-empty"}>读取中…</p>
        ) : list.length === 0 ? (
          <p className={"pl-empty"} style={{ padding: '28px 6px', color: '#8a6a52', fontSize: 12.5 }}>
            还没有条目。上面写一条，它就出现在这里 ✓
          </p>
        ) : (
          KIND_ORDER.map((k) => {
            const group = list.filter((i) => i.kind === k)
            if (group.length === 0) return null
            return (
              <div key={k} className={"pl-group"}>
                <div className={"pl-groupHead"}>
                  <i className={"pl-dot"} style={{ background: KIND_TONE[k].dot }} />
                  <span>{KIND_LABEL[k]}</span>
                  <span className={"pl-count"}>{group.length}</span>
                </div>
                {group.map((p) => {
                  const due = describeDue(p.due_date)
                  return (
                    <div key={p.id} className={'pl-item' + (p.done ? ' pl-itemDone' : '')}>
                      <button
                        type="button"
                        className={"pl-check"}
                        onClick={() => void plans.update(p.id, { done: !p.done })}
                        aria-label={p.done ? '标记未完成' : '标记完成'}
                      >
                        {p.done ? '✓' : ''}
                      </button>
                      <div className={"pl-itemMain"}>
                        <span className={"pl-itemTitle"}>{p.title}</span>
                        {p.kind === 'goal' && (
                          <span className={"pl-bar"}>
                            <i style={{ width: Math.max(0, Math.min(100, p.progress)) + '%' }} />
                          </span>
                        )}
                      </div>
                      {due && (
                        <span
                          className={"pl-due" + (due.tone === 'overdue' ? ' pl-dueOver' : due.tone === 'soon' ? ' pl-dueSoon' : '')}
                        >
                          {due.text}
                        </span>
                      )}
                      <button
                        type="button"
                        className={"pl-del"}
                        onClick={() => void plans.remove(p.id)}
                        aria-label="删除"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          })
        )}
      </section>
    </div>
  )
}
