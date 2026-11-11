# Skill 完整登记表

> **17 份已全部落地到 `.skills/`**（2026-11 抓取，共 238KB）
> 来源：<https://github.com/emilkowalski/skills>
> 目录页：<https://skills.sh/emilkowalski/skills>
> 安装命令：`npx skills@latest add emilkowalski/skills`
> 作者：Emil Kowalski（Vercel、Linear 出身的设计工程师）

---

## 一、本地文件清单（17 份，已全部下载）

| 文件 | 大小 |
|---|---|
| `README.md` | 5KB |
| `STANDARDS.md` | 10KB |
| `animate-expo.md` | 17KB |
| `animate.md` | 12KB |
| `animation-performance.md` | 14KB |
| `animation-vocabulary.md` | 13KB |
| `apple-design.md` | 22KB |
| `ask-sonner.md` | 7KB |
| `break-ui.md` | 14KB |
| `emil-design-eng.md` | 27KB |
| `find-animation-opportunities.md` | 10KB |
| `improve-animations.md` | 8KB |
| `mobile-native.md` | 16KB |
| `pick-ui-library.md` | 5KB |
| `prototype.md` | 8KB |
| `review-animations.md` | 8KB |
| `write-swift.md` | 41KB |

地址规律：
```
https://raw.githubusercontent.com/emilkowalski/skills/main/skills/<名字>/SKILL.md
（STANDARDS.md 在 skills/review-animations/STANDARDS.md）
```

---

## 二、17 个 skill 各自管什么

| Skill | 用途 |
|---|---|
| emil-design-eng | **核心**：UI 打磨哲学，动画为主、兼顾设计判断 |
| review-animations | 按十条硬标准审查动画，默认挑刺、通过要"挣" |
| STANDARDS.md | 曲线 / 时长 / 弹簧 / 手势 / clip-path / 性能 / a11y 的精确数值表 |
| animate | 从零建动画：先判断该不该动 → 目的 → 工具 → 属性 → 曲线时长 → 中断 → 出场 |
| animate-expo | React Native / Expo 版同一套标准（手势、弹层、触感、转场） |
| improve-animations | 全库扫描，输出分级、可执行的改造计划 |
| find-animation-opportunities | 找"该动却没动"的地方，同时指出"不该动"的地方 |
| animation-performance | 修掉帧（大量易被忽略的细节） |
| animation-vocabulary | 用准确的词描述动画，让 AI 输出更准 |
| apple-design | Apple 的界面与流体动效原则，翻译成 Web 可用 |
| pick-ui-library | 按任务挑可信的库，别让 AI 手搓 toast |
| prototype | 一次做多个版本，用切换器对比 |
| mobile-native | Web 在手机上像原生：100vh bug、输入框缩放、点击延迟、安全区 |
| break-ui | 极端数据压测：超长名字、空列表、巨大数字、长标签 |
| ask-sonner | Sonner（toast 库）的配置、样式、配方与排错 |
| write-swift | 现代 Swift：值类型、Swift 6 并发、泛型、性能、Swift Testing |
| README.md | 仓库索引与说明 |

---

## 三、DSH 自带 skill（随环境提供，无需安装）

| Skill | 用途 |
|---|---|
| `diagnose-windows-sandbox-acl` | Windows 沙箱 ACL 拒绝的诊断与修复 |
| `office-docx` | Word 文档创建 / 读取 / 编辑 |
| `office-pptx` | PPT 创建 / 读取 / 编辑 |
| `office-xlsx` | Excel 读取 / 写入 / 公式 / 格式 |

---

## 四、已提炼并写进项目的规则

### 动效 token（见 `app/v4.css`）

```css
--ease-out:    cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--dur-hover: 160ms;
--dur-state: 200ms;
--dur-enter: 320ms;
```

### 十条硬标准（review-animations）

1. 动效必须有理由
2. 频率决定动效（每天几十次的不加动画）
3. 入场用 ease-out 或强曲线；**UI 上 ease-in 是阻断级错误**
4. UI 动效 **< 300ms**
5. 弹层从触发器缩放，**不用 scale(0)**
6. 可中断（CSS transition / spring）
7. **只动 transform / opacity**
8. `prefers-reduced-motion` 减弱不归零；hover 要门控
9. 进出场不对称（出场更快）
10. 语气一致；**不确定就删掉**

---

## 五、下一步怎么用

```
· 改样式前：读 .skills/emil-design-eng.md
· 改动效前：读 .skills/review-animations.md + .skills/STANDARDS.md
· 做手机版前：读 .skills/mobile-native.md
· 上线前压测：读 .skills/break-ui.md
· 掉帧排查：读 .skills/animation-performance.md
```

> 注意：这些都是**文档**，不是 DSH 自动加载的 skill。
> 需要时由我主动读取；也可以在对话里直接点名某一份，我按它执行。

---

_最后更新：本次会话末 · 17/17 已落地_
