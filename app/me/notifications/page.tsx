'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { pageAccentVars } from '../../../components/theme'
import { NotificationsList } from '../../../components/notifications'

/**
 * 通知页
 *
 * 内容全在 NotificationsList 里（那个组件也用在别处），这里只负责取当前用户。
 */
export default function NotificationsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [meId, setMeId] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await supabase.auth.getUser()
      if (cancelled) return
      if (!data.user) {
        router.push('/login')
        return
      }
      setMeId(data.user.id)
      setChecked(true)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  return (
    <div className="min-h-screen relative overflow-hidden" style={pageAccentVars('me')}>
      <div className="absolute -top-20 -right-20 w-96 h-96 bg-[var(--accent-light)] opacity-20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative max-w-xl mx-auto px-6 py-10">
        <header className="mb-6">
          <Link
            href="/me"
            className="text-sm text-[var(--accent-muted)] transition hover:text-[var(--accent-deep)]"
          >
            ← 返回
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-[#2b2430]">通知</h1>
          <p className="mt-1 text-sm text-[var(--accent-muted)]">
            提到你、回了你的信、处理了你的举报，都会落在这里。
          </p>
        </header>

        {checked && <NotificationsList userId={meId} />}
      </div>
    </div>
  )
}
