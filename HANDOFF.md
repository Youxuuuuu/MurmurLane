# MurmurLane 架构迁移与移动端遗留问题交接

更新时间：2026-07-29

## 给新会话的最短说明

当前仓库是 `D:\study\MurmurLane`，当前分支为 `dev/ins-chat`。MurmurLane 架构迁移代码已经完成，统一手机真机验收也已经执行；验收发现的迁移回归与 MurmurLane 局部 UI 问题均已修复，并由用户确认解决。

现在只剩两个相互独立的后续问题：

1. 浏览器进入后台约 10 秒以上后，页面可能重新加载并回到初始页面。它属于新的跨刷新/页面重建状态恢复能力，不是本次架构迁移遗漏。
2. realme Android 15 的 Chrome 150 中，软键盘顶部会与 Conversation 输入框底部重叠。它是迁移前已经存在的 Android Chrome 兼容问题。

不要再继续“补架构迁移”。下一次工作应把这两个问题分别作为独立任务讨论、诊断、测试和提交。

开始工作前依次阅读：

- `AGENTS.md`
- `CONTEXT.md`
- 本文件
- `docs/architecture/current-architecture.md`
- `docs/architecture/migration-plan.md`
- `docs/adr/0011-migrations-are-characterized-one-seam-at-a-time.md`
- `docs/adr/0012-controllers-outlive-views-within-the-app-session.md`

然后执行：

```powershell
git status --short
git log -10 --oneline
```

## 我们在做什么

本轮最初目标是基于真实源码整理 MurmurLane 架构，使后续功能进入正确的所有者，同时严格保持既有 UI、CSS、DOM、滚动、窗口化、手势和动画。

当前已经落地的架构以以下文档为总览入口：

```text
docs/architecture/current-architecture.md
```

架构决策记录在 `docs/adr/0001-*.md` 至 `docs/adr/0019-*.md`。实施顺序、每阶段测试、提交与结果记录在：

```text
docs/architecture/migration-plan.md
```

不要在交接后重新设计一套架构，也不要把 ADR 中的目标结构误说成迁移前事实。

稳定所有权、运行时数据流、静态依赖方向和新功能投放规则不要在本文件重复维护，以 `docs/architecture/current-architecture.md` 为准。

## 已经完成

### 架构迁移与文档收尾

- ADR-0001～ADR-0019 的代码实施、统一浏览器验收与手机真机验收均已完成。
- 当前架构总览已经写入 `docs/architecture/current-architecture.md`。
- ADR-0011 已更新为 `Implementation: Complete` 和 `Browser and device validation: Complete`。
- Conversation Transcript、Composition Root、Browser/Server Config、ContentSync、Conversation/Timeline/Archive Workspace、App Navigation、搜索所有权、Server 分层、严格类型、错误边界、状态所有权和静态依赖边界均已落地。
- `App.tsx` 和 `ConversationPage.tsx` 已移除 `@ts-nocheck`。
- Server 已进入独立 TypeScript 检查。
- 架构迁移阶段的详细提交不要在这里重复，查看：

```powershell
git log --oneline -- docs/adr docs/architecture src server test
```

架构迁移完成账本提交：

```text
4b42369 docs: 记录架构迁移完成与真机待验收
```

### 真机验收

用户在以下环境完成过统一验收：

- realme，Android 15，Chrome 150
- iPhone XS Max，iOS 18.6.2，Chrome
- 局域网 Wi-Fi 下访问 Vite 开发服务器

已经验收通过的主要范围：

- Conversation、Timeline、Archive 导航与应用会话内状态保持
- Conversation 线程、日期、线程内搜索和全局搜索
- Transcript 顺序、历史加载、滚动锚点、窗口化、浮动日期和动画身份
- 文字、图片、文件、Sticker 发送与重试
- WebChat 重连、Cursor、未读和通知
- 移动端触摸、左滑、图片预览、页面安全区域
- Timeline 与 Archive 查看、搜索、保存、删除和失败回退
- 整体视觉样式和交互动画

此前发现的 Cyberboss 发送状态与 Codex 实时附件问题，用户已在 2026-07-29 明确确认解决。除非出现新的可复现证据，不要在 MurmurLane 中为它们增加轮询、解析工具提示文字或其他兜底。

### 真机验收后完成的 MurmurLane 修复

以下三个修复已经分别测试和提交，并由用户确认解决：

```text
86091fd fix: 消费 Workspace 搜索高亮目标
a990818 fix: 让新消息按钮避让输入框
78b6048 fix: 固定长分享预览操作区
```

具体结果：

- Timeline/Archive 搜索目标在高亮完成后由对应 Workspace 消费，页面往返不再重复播放旧高亮。
- 新消息跳转按钮依据 Composer 实际高度和键盘位移定位，不再被输入框遮挡。
- 长日记/信件分享时只滚动预览区，底部按钮始终可见，导出正文不截断。

最后一次完整自动基线：

```text
npm test
→ 142/142 通过

npm run typecheck:strict
→ 通过

npm run typecheck:server
→ 通过

npm run build
→ 通过
```

生产构建仍有既有的 500 kB Chunk Size Warning，本轮没有处理，也不要把它混入下面两个移动端任务。

## 当前卡在哪里

没有架构迁移代码阻塞。当前是两个后续问题尚未立项和设计。

### 遗留问题一：后台后页面重载与状态恢复

#### 已知表现

不论当前在哪个 Workspace，进入后台约 10 秒以上再返回时，页面可能重新加载并回到初始 Conversation 列表。用户希望返回时仍处于离开前的页面。

#### 已确认边界

ADR-0012 明确规定：

```text
Controller 只在 AppRoot 应用会话内常驻
浏览器刷新、关闭页面或 AppRoot 卸载会结束当前应用会话
当前架构不自动引入 localStorage、IndexedDB 或跨浏览器会话恢复
```

因此它不是“Controller 生命周期迁移失败”，而是新增的跨页面重建恢复能力。

目前不能未经诊断就断言是普通刷新、Android 标签页回收、PWA 页面重建、Service Worker 或开发服务器连接造成。实现前应先记录：

- `pageshow`、`pagehide`、`visibilitychange` 的顺序
- `pageshow.persisted`
- `performance.getEntriesByType("navigation")` 的 navigation type
- AppRoot 是否真的重新创建
- 只在开发服务器复现，还是生产构建也复现

#### 需要用户确认的产品语义

开始实现前至少确认：

- 只恢复同一标签页刷新，还是浏览器完全关闭后也恢复
- 恢复哪些状态：Workspace、子页面、线程、日期、Archive 模式、Timeline 模式、搜索页
- 是否恢复未发送草稿
- 是否恢复滚动位置
- 状态多久过期
- 已删除或已失效的线程、日期和文档如何回退

不要默认把所有 Controller State 全量序列化。

### 遗留问题二：Android Chrome 键盘与输入框重叠

#### 已知表现

- realme Android 15 + Chrome 150：键盘顶部与 Conversation 输入框底部重叠。
- 同一 realme 的 Via 浏览器正常。
- iPhone XS Max 的 Chrome 正常。
- 该问题在架构迁移前已经存在。

#### 当前代码入口

重点检查：

```text
src/lib/useStableViewport.ts
src/components/conversation/ConversationComposer.tsx
src/components/layout/AppShell.tsx
src/index.css
index.html
```

当前机制：

- `useStableViewport()` 同时读取 `window.innerHeight`、`visualViewport.height` 和 `visualViewport.offsetTop`。
- 它计算 `--app-stable-height` 与 `--app-keyboard-inset`。
- `ConversationComposer` 通过 `translateY(calc(var(--app-keyboard-inset) * -1))` 上移。
- 代码已尝试识别“Layout Viewport 已随键盘缩小”的浏览器，避免重复上移。

真实 realme Chrome 很可能报告了不同的 Layout/Visual Viewport 组合，但没有采集值之前不能确定公式哪一项错误。

实施前应在问题设备采集键盘打开/关闭时的：

```text
window.innerHeight
document.documentElement.clientHeight
visualViewport.height
visualViewport.offsetTop
visualViewport.pageTop
screen.height
--app-stable-height
--app-keyboard-inset
Composer.getBoundingClientRect()
```

还应确认 Chrome 是否使用覆盖键盘模式、地址栏展开/收起是否影响结果，以及输入框是“少上移了一段”还是 safe-area/padding 重复计算。

## 下一步计划

两个问题必须分别执行，不能放进同一个提交。

### 计划 A：跨刷新状态恢复

推荐顺序：

1. 先诊断真实页面生命周期，不直接写持久化。
2. 与用户确认恢复范围和过期规则。
3. 单独提出 ADR 或 tracker issue，标记 `Repo: murmurlane`。
4. 为当前“刷新后回到初始状态”补 Characterization Test。
5. 在 App Composition Boundary 建立窄的 Session Restore/Persistence Port。
6. 只保存经过允许、版本化且不敏感的用户意图状态。
7. ContentSync 启动后，由各目标 Workspace 校验并解释恢复目标。
8. 无效目标使用现有 App Navigation/Workspace 回退规则。
9. 自动测试、生产构建、同一台手机真机验收。
10. 独立提交。

优先评估 `sessionStorage` 是否满足“同一标签页重载恢复”，不要未经产品确认直接升级为永久 `localStorage` 或 IndexedDB。

### 计划 B：Android Chrome 键盘

推荐顺序：

1. 在 realme Chrome 采集上述 Viewport 数据，确认根因。
2. 用纯函数抽出“键盘位移计算”或等价 seam，并先补失败测试。
3. 只修正 `useStableViewport`/Composer 的位移计算，不改 Conversation 领域状态。
4. 不改变输入框 DOM、滚动容器、消息锚点和 Framer Motion。
5. 在 Android Chrome、Via 和 iOS Chrome 重新验收，避免修好一个浏览器却破坏另外两个。
6. 完整运行测试、类型检查和生产构建。
7. 独立提交。

## 绝对不要再踩的坑

### 架构与所有权

- 不要把跨刷新恢复继续塞回 `App.tsx` 的零散 Effect。
- Workspace、ContentSync 和 View 不得直接查找全局 Service Registry 或自行读取基础设施配置。
- View 只通过 View Model 与 Commands 参与领域行为。
- 不要让 Workspace 互相读 Store；跨 Workspace 恢复目标仍走 App Navigation Intent。
- 不要建立通用 `GlobalStateRegistry`、`UniversalCache` 或全局 Event Bus。

### 持久化

- 不要持久化 Token、Header、Adapter Cause、Server 路径、原始 Error 或完整 Dependencies。
- 不要把 Canonical Snapshot、ContentSync Cache、Live Record、SSE Cursor 和 Mutation Overlay 不加区分地整体序列化。
- 不要用 Effect 维护两份等价 Workspace State。
- 不要在恢复时绕过 Workspace 对线程、日期和文档合法性的校验。
- 不要声称 `sessionStorage`、`localStorage` 或 IndexedDB 可以互相替换；它们的关闭、刷新、跨标签页和过期语义不同。

### Android 键盘

- 不要按 UA、realme 型号或 Chrome 版本写硬编码分支。
- 不要用固定的额外 `bottom`/`padding-bottom` 数字掩盖 Viewport 公式错误。
- 不要仅根据一次 `resize` 事件判断键盘状态；移动地址栏、旋转和 Visual Viewport 滚动都会触发相似变化。
- 不要把 `100vh`、`100dvh` 或 `visualViewport.height` 当作所有 Android 浏览器都一致的真相。
- 不要通过修改 viewport 缩放策略来修复键盘重叠；这属于独立交互与可访问性行为。
- 不要只在桌面模拟器验证。这个问题必须由 realme 真机 Chrome 复验。

### 实施与验证

- 新增代码中确实需要的注释必须使用中文。
- 每个问题先补 Characterization/失败测试，再修改实现。
- 每个问题独立测试、独立构建、独立提交、独立回退。
- 不要顺便改 UI 风格、CSS 体系、动画、滚动或目录。
- `npm run build` 在 Windows 并行运行时曾因 `tsconfig.*.tsbuildinfo` 写入冲突出现 `EPERM`；生产构建应串行执行。
- Vite 500 kB Chunk Warning 是现有基线，不要误报成这两个任务造成的失败。
- 不要仅凭 Node 测试宣称 Android 键盘已修复，最终必须记录真机结果。

## 建议新会话使用的技能

### 状态恢复任务

- `grilling`：在写代码前确认恢复范围、关闭浏览器后的语义、过期时间和隐私边界。
- `codebase-design`：设计最小的 Session Restore seam，保持 Composition Root、Navigation 和 Workspace 所有权。
- `tdd`：先锁定刷新前后目标状态与非法目标回退，再实现。

### Android Chrome 键盘任务

- `diagnosing-bugs`：先采集真实 Viewport 和 Composer 几何数据，建立可证伪的根因假设。
- `tdd`：将键盘位移规则转成可执行的回归测试。
- `vercel-react-best-practices`：修改 React Effect 或布局测量后检查订阅、清理和重渲染风险。

Playwright 或桌面浏览器模拟可以辅助检查普通 DOM，但不能替代 realme 真机 Chrome 的最终验收。

## 交接完成标准

新会话只要做到以下几点，就算正确接手：

- 不再重复架构迁移。
- 把两个遗留问题拆成两个独立任务。
- 在没有真机 Viewport 证据前，不猜 Android Chrome 修复。
- 在没有产品恢复语义前，不批量持久化 Controller State。
- 每项修改保持中文必要注释、自动验证、真机验收和独立提交。
