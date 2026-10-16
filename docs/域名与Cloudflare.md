# 域名 + Cloudflare 上线清单（免费路线）

> 目标：让朋友在**国内直接打开**，不用代理。
> 花费：**只有域名钱**（¥38/年）✓ Cloudflare 免费 ✓ 不需要服务器 ✓ 不需要备案 ✓
> 顺序很重要，**照下面 1→8 走**，中间有两处顺序错了会绕圈 ✗

---

## 准备

- [ ] 域名已买 + **实名已通过**（阿里云控制台 → 域名 → 状态显示「正常」✓）
- [ ] 有一个能用的邮箱（注册 Cloudflare 用 ✓）
- [ ] 知道你的 Vercel 项目：`treehole`（线上地址 `treehole-rho.vercel.app`）

---

## 1. 在 Vercel 里先把域名加上（**先做这步** ⚠️）

```
Vercel → 选项目 treehole → Settings → **Domains**
→ 输入你的域名（例：yourletters.cn）→ Add
→ 它会给两种加法：
     · 如果它让你改 NS → 忽略 ✗（我们要用 Cloudflare 管 DNS ✓ 见第 4 步）
     · 如果它给你一条 **CNAME 目标** → **记下来** ✓
       形如：cname.vercel-dns.com  或  xxxxx.vercel-dns-017.com
       （每个项目不一样 ✓ **以它显示的为准** ✓ 不要照抄别人的 ✗）
```

> ⚠️ 为什么先做这步：Vercel 要先知道"这个域名是我的" ✓ 才会给它签证书 ✓
> 顺序反了（先在 CF 开小黄云再绑域名）会出现证书错误 ✗ 或访问循环 ✗

## 2. 注册 Cloudflare

```
打开 https://dash.cloudflare.com/sign-up
→ 邮箱 + 密码 → 验证邮箱 ✓（免费 ✓ 不用绑卡 ✓）
```

## 3. 添加站点

```
Cloudflare 控制台 → **Add a site** → 输入你的域名（例 yourletters.cn）
→ 计划选 **Free** ✓
→ 它会自动扫一遍你现有的 DNS 记录（阿里云的）→ 不用管 ✓ 下一步
```

## 4. 改域名的 NS（名称服务器）—— 去**阿里云**做

```
Cloudflare 会给你**两个** NS 地址，形如：
    xxx.ns.cloudflare.com
    yyy.ns.cloudflare.com

→ 复制这两个 ✓
→ 阿里云 → 域名 → 找到你的域名 → **DNS 修改 / 修改 DNS 服务器**
→ 把阿里云默认的两个 NS 换成 Cloudflare 这两个 ✓ 保存

⏱ 等多久：通常 **10 分钟 ~ 2 小时**（最长 24 小时 ✗）
验证：Cloudflare 控制台首页会从「Pending」变成「**Active**」✓
```

## 5. 在 Cloudflare 里加 DNS 记录

```
Cloudflare → 你的域名 → **DNS** → Records → Add record
   类型：**CNAME**
   名称：**@**        （@ = 根域名本身，即 yourletters.cn）
   目标：第 1 步记下的那条 **Vercel CNAME 目标** ✓
   代理状态：**Proxied（橙色小黄云 ✓）** ← 一定要是橙色 ⚠️

再来一条 www（可选但建议）：
   类型 CNAME · 名称 **www** · 目标同上 · Proxied ✓
```

## 6. Cloudflare 的 SSL/TLS 设置（两处，别漏）

```
Cloudflare → **SSL/TLS** → Overview
   模式选 **Full (strict)** ⚠️
   ✗ 不要选 Flexible（会造成重定向循环 ✗）
   ✗ 不要选 Off

Cloudflare → SSL/TLS → **Edge Certificates**
   **Always Use HTTPS** → 打开 ✓
```

## 7. Supabase 白名单（最容易漏 ✗ 漏了登录会失败）

```
Supabase → Authentication → **URL Configuration**
   Site URL      : https://yourletters.cn
   Redirect URLs : https://yourletters.cn/**
                   https://www.yourletters.cn/**
                   http://localhost:3000/**
→ Save
```

## 8. Vercel 环境变量 + 重新部署

```
Vercel → 项目 → Settings → **Environment Variables**
   NEXT_PUBLIC_SITE_URL = https://yourletters.cn
→ Save

Vercel → Deployments → 最新一条 → 右上 **⋯** → **Redeploy**
（环境变量改了必须重新部署才生效 ✓）
```

---

## 验证（等 DNS 生效后逐条走）

```
① 浏览器打开 https://yourletters.cn   → 能进首页 ✓
   （地址栏有小锁 🔒 = HTTPS 正常 ✓）
② 打开 https://www.yourletters.cn     → 自动跳到根域名 ✓
③ **退出登录**状态直接开 /            → 安静跳到登录页 ✓（不该出现红条）
④ 登录一次                           → 能进、能收到数据 ✓
   （登不上 = 第 7 步没做 ✓）
⑤ 手机流量（不连 WiFi）打开           → 这是最关键的一条 ✓
⑥ 让 2-3 个朋友打开，问他们"能开吗？快吗？"
```

## 判断要不要上香港服务器

| 朋友反馈 | 结论 |
|---|---|
| 都能开 ✓ 速度能接受 ✓ | **结束** ✓ 不用买服务器 ✓ 省下 ¥38/月 ✓ |
| 能开但**很慢** ⚠️ | 先看是不是首次慢（CF 缓存没热 ✓）→ 第二天再问 ✓ 还慢 → 考虑香港 ✓ |
| **打不开 / 经常转圈** ✗ | 上香港轻量反代 ✓（域名继续用 ✓ 不用重买 ✓）|

---

## 常见坑（按出现频率排）

| 现象 | 原因 | 解决 |
|---|---|---|
| 一直「Pending」| NS 没改对 / 还没生效 | 阿里云确认两个 NS 与 CF 给的**完全一致** ✓ 再等 ✓ |
| 访问报 **重定向次数过多** | CF 的 SSL 模式是 Flexible ✗ | 改成 **Full (strict)** ✓ |
| 访问显示 **525 / 526** | CF 与 Vercel 之间证书问题 | 确认第 1 步已在 Vercel 加过域名 ✓ 等几分钟 ✓ 仍是 526 就先把小黄云改灰（DNS only ✓）测试 ✓ |
| 页面能开但**登录失败** | Supabase 白名单没加 ✗ | 做第 7 步 ✓ |
| 页面样式不对 / 旧版 | 环境变量改了没重新部署 ✗ | 做第 8 步的 Redeploy ✓ |
| 域名状态是「**待实名**」| 实名还没过 | 等审核 ✓（通常几十分钟~2 小时 ✓）|

---

## 我这边能帮你做的

| 步骤 | 谁做 |
|---|---|
| 1 Vercel 加域名 | 你（dashboard）· 我可以逐步截图对照 |
| 2-6 Cloudflare | 你（dashboard）· 有问题随时问我 |
| 7 Supabase 白名单 | 你（dashboard）· 我给准确位置 |
| 8 Vercel 环境变量 + Redeploy | 你（dashboard）· 我给准确位置 |
| 域名上线的**代码侧**（页脚显示域名 / 分享卡片）| **我** ✓ 说一声就改 |
