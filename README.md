# 树洞 · 你的来信

一个安静的树洞站：写信、院子、朋友圈、冬日信箱。
给朋友用的小站，暖色纸感，能写心事、也能被认真回信。

---

## 本地跑起来

```bash
npm install
npm run dev      # http://localhost:3000
```

（项目用的是 **npm**，锁文件是 `package-lock.json`。）

Supabase 的地址与 publishable key 有**两份来源**：优先读环境变量，
读不到就用 `app/lib/supabase.ts` 里写好的默认值。

```
NEXT_PUBLIC_SUPABASE_URL        （可选）
NEXT_PUBLIC_SUPABASE_ANON_KEY   （可选）
```

留着默认值是故意的：那个 key 是设计上公开的（publishable），写在前端没有问题，
而且**不配变量也能跑**——本地开发和临时部署不会因为忘设变量而白屏。
要换 Supabase 项目时，在 Vercel 里设这两个变量就不用改代码。

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
| `supabase-conversations-last-message.sql` | 给 `conversations` 加 `last_message_at` + 触发器 | 好友列表排序退回「最近 400 条消息」的近似算法，好友多时可能排不准 |
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

**看 [`docs/部署步骤.md`](docs/部署步骤.md)。** 简要版：

从这台机器测出来 **github.com 不通（连接被重置）**，所以「推 GitHub → Vercel 自动拉取」
那条路走不通。改用 Vercel 官方 CLI，**把本地文件直接传上去，不需要 GitHub**：

```bash
npx vercel login          # 选「Continue with Email」，不要选 GitHub（那个要连 github.com）
npx vercel                # 第一次：一路回车
npx vercel --prod         # 发布到正式环境，拿到域名
```

环境变量（在 Vercel 网页里设，或用 `npx vercel env add`）：

```
NEXT_PUBLIC_SITE_URL=https://你的域名
```

> ⚠️ 因为推不上 GitHub，**代码目前只在本机**。等网络能连上时记得 `git push` 一次，
> 否则硬盘坏了就没了。

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

- 上线前还要做什么、哪些是以后再说的事，见 [`docs/收尾清单.md`](docs/收尾清单.md)
- **只属于站主的待办**（后台配置、备份定时、上线前自检）见 [`docs/你要做的.md`](docs/你要做的.md)
