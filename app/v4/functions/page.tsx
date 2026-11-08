import { redirect } from 'next/navigation'

/** 老地址 /v4/functions → /functions（功能区已经是正式路由）*/
export default function V4FunctionsPage() {
  redirect('/functions')
}
