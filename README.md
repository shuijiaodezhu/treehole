# 树洞 · 你的来信

一个安静的树洞站：写信、院子、朋友圈、冬日信箱。
给朋友用的小站，暖色纸感，能写心事、也能被认真回信。

---

## 本地跑起来

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Supabase 的地址与 publishable key 直接写在 `app/lib/supabase.ts` 里
（那个 key 是设计上公开的，放进前端没有任何问题）。

> ⚠️ `NEXT_PUBLIC_SITE_URL` 目前只在 `app/layout.tsx` 里用来生成分享卡片的地址。
> 本地不设也行（默认 `http://localhost:3000`）；部署时**必须**设成正式域名，
> 否则分享出去的是 localhost。

---

## 数据表与策略

**功能要正常工作，下面这些 SQL 必须先在 Supabase → SQL Editor 里跑过。**
语句都是 `if not exists` / `drop ... if exists`，重复跑不会出错。

| SQL 文件 | 负责什么 | 不跑会怎样 |
|---|---|---|
| `supabase-security.sql` | 登录日志、注销申请、数据库层限流 | 设置页「登录设备」空着；注销提交失败；限流只剩客户端那层 |
| `supabase-winter-mailbox.sql` | 冬日信箱的表与策略 | 点开信箱会说「还没开通」 |
| `supabase-realtime.sql` | 把 `messages` 等表加入 Realtime 发布 | 聊天退化成 20 秒兜底轮询，不是「一发就到」 |
| `supabase-site-pages.sql` + `supabase-site-pages-fix.sql` | 站内页面（公约/隐私/协议…）可编辑 | 用的是代码里的内置初稿 |
| `supabase-vault.sql` | 储物箱 | 传文件时会 403 |
| `supabase-plans.sql` | 计划书 | — |
| `supabase-favorites.sql` + `supabase-favorites-images.sql` | 收藏 | — |
| `supabase-blocks-visibility.sql` + `supabase-blocks-grants.sql` | 拉黑与屏蔽 | — |
| `supabase-media-bucket.sql` | 图片存储桶 | 传图失败 |
| `supabase-activity.sql` | 活跃统计（后台看板） | 后台统计少一块 |
| `supabase-admin-policies.sql` | 站主后台的读写权限 | 后台改不动任何东西 |

> `supabase-mailbox-check.sql` 是**只读的核查脚本**，用来确认好友私聊的
> RLS 是否到位；不改任何东西，想跑就跑。

跑完最好用这句确认（只读）：

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;
```

---

## 认证相关（Supabase 后台设置）

| 设置 | 位置 | 说明 |
|---|---|---|
| **Confirm email** | Authentication → Sign In / Providers → Email | 打开后新用户要先点邮件里的链接；注册页会提示「确认邮件已发到…」 |
| **Site URL / Redirect URLs** | Authentication → URL Configuration | **找回密码必须配**：Site URL 填正式域名，Redirect URLs 加 `http://localhost:3000/**` 和 `https://你的域名/**` |
| **SMTP** | Project Settings → Auth → SMTP Settings | ⚠️ 内置邮件服务**每小时只能发个位数**，只够自己测。要让朋友注册，必须配自定义 SMTP |
| **邮件模板** | Authentication → Email Templates | 默认是英文，改成中文体验更统一 |

---

## 部署

Vercel 直接连这个仓库即可。环境变量：

```
NEXT_PUBLIC_SITE_URL=https://你的域名
```

部署后记得回 Supabase 的 **Redirect URLs** 把正式域名加进去，
否则找回密码的链接会跳到 localhost。

---

## 备份

```powershell
$env:SUPABASE_DB_URL = "postgresql://postgres:<数据库密码>@db.cdmytrvpskkdwjsenidt.supabase.co:5432/postgres"
pwsh -File scripts/backup.ps1
```

需要本机装了 PostgreSQL 客户端（`winget install PostgreSQL.PostgreSQL.16`）。
脚本自动保留最近 14 份，`backups/` 已在 `.gitignore` 里。
定时用 Windows 任务计划程序，步骤写在脚本注释里。

---

## 收尾清单

上线前还要做什么、哪些是以后再说的事，见 [`docs/收尾清单.md`](docs/收尾清单.md)。
