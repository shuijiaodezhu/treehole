import { redirect } from 'next/navigation'

/** 老地址 /v4/mailbox → /mailbox（冬日信箱已经是正式路由）*/
export default function V4MailboxPage() {
  redirect('/mailbox')
}
