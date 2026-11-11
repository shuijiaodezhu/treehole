# Skill 完整登记表

> 用途：**记忆**。以后要按 skill 的标准改代码，从这里查全名单和地址。
> 来源仓库：<https://github.com/emilkowalski/skills>
> 目录页：<https://skills.sh/emilkowalski/skills>
> 安装命令：`npx skills@latest add emilkowalski/skills`
> 作者：Emil Kowalski（曾在 Vercel、Linear 做设计工程）

---

## 一、Emil Kowalski 的 17 个 skill（全名单）

### ✅ 已落地到项目 `.skills/` 的 4 份

| # | Skill | 本地文件 | 大小 | 地址 |
|---|---|---|---|---|
| 1 | **emil-design-eng** | `.skills/emil-design-eng.md` | 26KB | https://github.com/emilkowalski/skills/blob/main/skills/emil-design-eng/SKILL.md |
| 2 | **review-animations** | `.skills/review-animations.md` | 8KB | https://github.com/emilkowalski/skills/blob/main/skills/review-animations/SKILL.md |
| 3 | **review-animations / STANDARDS.md** | `.skills/STANDARDS.md` | 10KB | https://github.com/emilkowalski/skills/blob/main/skills/review-animations/STANDARDS.md |
| 4 | **animate** | `.skills/animate.md` | 12KB | https://github.com/emilkowalski/skills/blob/main/skills/animate/SKILL.md |

### ⬜ 尚未落地、但已登记（13 份）

| # | Skill | 一句话用途 | 地址 |
|---|---|---|---|
| 5 | **animate-expo** | React Native / Expo 的同类标准：手势、弹层、触感、屏幕转场 | https://github.com/emilkowalski/skills/blob/main/skills/animate-expo/SKILL.md |
| 6 | **improve-animations** | 全库扫描动画，输出可执行的分级改造计划 | https://github.com/emilkowalski/skills/blob/main/skills/improve-animations/SKILL.md |
| 7 | **find-animation-opportunities** | 找出"该动却没动"的地方，同时指出"不该动"的地方 | https://github.com/emilkowalski/skills/blob/main/skills/find-animation-opportunities/SKILL.md |
| 8 | **animation-performance** | 修掉掉帧的动画（大量细节） | https://github.com/emilkowalski/skills/blob/main/skills/animation-performance/SKILL.md |
| 9 | **animation-vocabulary** | 用正确的词描述动画，让 AI 输出更准 | https://github.com/emilkowalski/skills/blob/main/skills/animation-vocabulary/SKILL.md |
| 10 | **apple-design** | Apple 的界面与流体动效原则，翻译成 Web 可用的版本 | https://github.com/emilkowalski/skills/blob/main/skills/apple-design/SKILL.md |
| 11 | **pick-ui-library** | 按任务挑对库，而不是让 AI 手搓 toast | https://github.com/emilkowalski/skills/blob/main/skills/pick-ui-library/SKILL.md |
| 12 | **prototype** | 一次做多个版本，用切换器对比 | https://github.com/emilkowalski/skills/blob/main/skills/prototype/SKILL.md |
| 13 | **mobile-native** | 让 Web 在手机上像原生：100vh bug、输入框缩放、点击延迟、安全区 | https://github.com/emilkowalski/skills/blob/main/skills/mobile-native/SKILL.md |
| 14 | **break-ui** | 用极端数据压测 UI：超长名字、空列表、巨大数字 | https://github.com/emilkowalski/skills/blob/main/skills/break-ui/SKILL.md |
| 15 | **ask-sonner** | Sonner（他的 toast 库）的用法与排错 | https://github.com/emilkowalski/skills/blob/main/skills/ask-sonner/SKILL.md |
| 16 | **write-swift** | 写现代 Swift（值类型、Swift 6 并发、泛型、Swift Testing） | https://github.com/emilkowalski/skills/blob/main/skills/write-swift/SKILL.md |
| 17 | **（README 本身）** | 索引与说明 | https://github.com/emilkowalski/skills/blob/main/README.md |

> 地址规律：`https://github.com/emilkowalski/skills/blob/main/skills/<名字>/SKILL.md`
> 抓原始文本把 `blob` 换成 `raw`：`https://raw.githubusercontent.com/emilkowalski/skills/main/skills/<名字>/SKILL.md`

---

## 二、DSH 自带 skill（随环境提供，无公开地址）

| # | Skill | 用途 | 何时用 |
|---|---|---|---|
| 1 | `diagnose-windows-sandbox-acl` | Windows 沙箱 ACL 拒绝的诊断与修复 | 工作区写入/读取莫名失败时 |
| 2 | `office-docx` | Word 文档的创建、读取、编辑 | 需要 .docx 交付或分析时 |
| 3 | `office-pptx` | PPT 的创建、读取、编辑 | 需要 .pptx 时 |
| 4 | `office-xlsx` | Excel 的读取、写入、公式、格式 | 需要 .xlsx 或表格分析时 |

> 这四个由 DSH 环境直接提供，**不需要安装**，调用时用 `skill` 工具按名字加载。

---

## 三、已从中提炼并写进项目的规则

### 动效（已落地，见 `app/v4.css` 的 token）

```css
--ease-out:    cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--dur-hover: 160ms;   /* hover */
--dur-state: 200ms;   /* 状态切换 */
--dur-enter: 320ms;   /* 进场 */
```

### 十条硬标准（review-animations）

1. 动效必须有理由
2. 频率决定动效（每天点几十次的不加动画）
3. 入场用 ease-out 或强曲线，**UI 上用 ease-in 是阻断级错误**
4. UI 动效 **< 300ms**
5. 弹层从触发器缩放，**不用 scale(0)**
6. 可中断（CSS transition / spring，不用 keyframes 重置）
7. **只动 transform / opacity**
8. `prefers-reduced-motion` 减弱不归零；hover 要门控
9. 进出场不对称（出场更快）
10. 语气一致；**不确定就删掉**

---

## 四、缺口与下一步

```
□ 13 份未落地的 skill，按需再抓（建议优先抓这 3 份）：
   · mobile-native        —— 手机版会直接用上（100vh/输入框/安全区）
   · break-ui             —— 上线前压测极端数据
   · animation-performance —— 掉帧排查
□ 抓取方式：用 node fetch 写 .skills/，不要用 PowerShell 的 > 重定向（会变 UTF-16）
```

---

_最后更新：本次会话末_
