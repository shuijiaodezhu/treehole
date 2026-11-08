'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import { MailboxPanel, useMailbox } from '../../components/mailbox'
import './mailbox.css'

/**
 * /mailbox —— 冬日信箱（电脑版正式页）
 *
 * 为什么是独立一页：
 *   · 首页的信箱是**弹窗**（MailboxDialog），左窄条上一排入口都跳路由，
 *     只有信箱弹窗的话点起来和其它几个不是一种手感 ✗
 *   · 所以这里给信箱一个自己的页面：外层是首页那套玻璃与冬日视频，
 *     里面的**读信 / 写信本体就是首页那个**（MailboxPanel，同一份代码）
 *
 * 数据不重写：useMailbox 里那张 winter_letters 表、限流、敏感词、
 * 已读位置（localStorage）、站主回信的实时订阅，全都沿用原来的。
 */

export default function MailboxPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    void createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!alive) return
        setUserId(data.user?.id ?? null)
        setEmail(data.user?.email ?? null)
        setReady(true)
      })
      .catch(() => {
        if (alive) setReady(true)
      })
    return () => {
      alive = false
    }
  }, [])

  const mailbox = useMailbox(userId)

  return (
    <div className={"v4-page v4m-page"}>
      {/* 背景沿用 v4 的冬日视频 */}
      <div className={"v4-bg"} aria-hidden>
        <video
          className={"v4-video"}
          src="/bg-winter.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
        <div className={"v4-scrim"} />
        <i className={"v4-glow v4-glow1"} />
        <i className={"v4-glow v4-glow2"} />
        <i className={"v4-glow v4-glow3"} />
      </div>

      {/* 窄屏提示：手机上还是用原来的首页（那边信箱在页头/左下）*/}
      <div className={"v4-mobileNote"}>
        这一版是电脑版（液态玻璃要宽屏才成立）
        <br />
        手机上请用 yourletters.cn 原来的首页，信箱在页头
        <br />
        <Link href="/" style={{ color: '#a0563f' }}>
          回首页 →
        </Link>
      </div>

      <div className={"v4m-wrap"}>
        <header className={"v4m-top"}>
          <Link href="/" className={"v4m-brand"}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={"v4-wordmark"} src="/wordmark-light.png" alt="你的来信" />
            <span>DEAR YOU</span>
          </Link>

          <span className={"v4-spacer"} />

          <div className={"v4m-account"}>
            <span className={"v4-email"}>{email || '未登录'}</span>
            <Link href="/" className={"v4-logout"}>
              ← 回院子
            </Link>
          </div>
        </header>

        <main className={"v4m-main"}>
          <div className={"v4m-shell v4-glass"}>
            {!ready ? (
              <p className={"v4m-wait"}>开信箱中…</p>
            ) : !userId ? (
              <div className={"v4m-login"}>
                <p className={"v4m-loginTitle"}>冬日信箱</p>
                <p className={"v4m-loginSub"}>
                  信是匿名的，但要先知道回给谁 ——
                  <br />
                  站主看不到你的名字，只看到这封信。
                </p>
                <Link href="/login" className={"v4m-loginBtn"}>
                  去登录
                </Link>
              </div>
            ) : (
              /* 和首页弹窗里是同一个组件：读信 / 写信 / 已读 / 实时回信 */
              <MailboxPanel
                mailbox={mailbox}
                className={"v4m-panel"}
                onClose={() => router.push('/')}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
