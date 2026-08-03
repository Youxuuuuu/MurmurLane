# MurmurLane 架构迁移、移动端键盘与状态恢复交接

更新时间：2026-07-31

## 给新会话的最短说明

当前仓库为本仓库根目录，当前分支为 `dev/ins-chat`。

MurmurLane 架构迁移、统一浏览器/真机验收，以及 Android Chrome Conversation 输入框遮挡修复均已完成。用户已经在 realme Android 15 的 Chrome 150 上确认键盘打开后不再遮挡输入面；相关临时诊断面板、轮廓和探针已经删除。

现在只剩一个独立后续问题：

- 浏览器进入后台约 10 秒以上后，页面可能重新加载并回到初始页面。它属于新的跨刷新/页面重建状态恢复能力，不是架构迁移遗漏。

iOS 键盘的 `∧∨完成` 辅助条属于浏览器/系统原生 UI。只有 Capacitor iOS 原生壳可以通过 `@capacitor/keyboard` 隐藏；用户当前只有 Windows 和 iPhone XS Max，没有 macOS/Xcode，已经决定不引入无法构建和验证的 Capacitor 工程。不要在当前浏览器/PWA 项目中加入无效的 `window.Capacitor` 片段。

不要再继续“补架构迁移”或重新猜测 Android 键盘公式。下一次工作应只把后台页面重建恢复作为独立任务讨论、诊断、测试和提交。

开始工作前依次阅读：

- `AGENTS.md`
- `CONTEXT.md`
- 本文件
- `docs/architecture/current-architecture.md`
- `docs/architecture/cross-repo-diagnosis.md`
- `docs/architecture/migration-plan.md`
- `docs/adr/0011-migrations-are-characterized-one-seam-at-a-time.md`
- `docs/adr/0012-controllers-outlive-views-within-the-app-session.md`

然后执行：

```powershell
git status --short
git log -10 --oneline
```

## 已完成的架构与验收

### 架构迁移

- ADR-0001～ADR-0019 的代码实施、统一浏览器验收与手机真机验收均已完成。
- 当前架构总览位于 `docs/architecture/current-architecture.md`。
- 跨仓库问题按照 `docs/architecture/cross-repo-diagnosis.md` 使用稳定身份和第一个错误 seam 判定归属。
- Conversation Transcript、Composition Root、Browser/Server Config、ContentSync、Conversation/Timeline/Archive Workspace、App Navigation、搜索所有权、Server 分层、严格类型、错误边界、状态所有权和静态依赖边界均已落地。
- `App.tsx` 和 `ConversationPage.tsx` 已移除 `@ts-nocheck`，Server 已进入独立 TypeScript 检查。
- 不要在交接后重新设计一套架构，也不要把 ADR 中的目标结构误说成迁移前事实。

架构入口：

```text
docs/architecture/current-architecture.md
```

实施与验证账本：

```text
docs/architecture/migration-plan.md
```

### 统一真机验收

用户在以下环境完成过验收：

- realme，Android 15，Chrome 150
- 同一 realme，Via 浏览器
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

### 真机验收后的局部修复

已经完成并由用户确认的修复包括：

```text
86091fd fix: 消费 Workspace 搜索高亮目标
a990818 fix: 让新消息按钮避让输入框
78b6048 fix: 固定长分享预览操作区
```

- Timeline/Archive 搜索目标在高亮完成后由对应 Workspace 消费，页面往返不再重复播放旧高亮。
- 新消息跳转按钮依据 Composer 实际高度和键盘位移定位，不再被输入框遮挡。
- 长日记/信件分享时只滚动预览区，底部按钮始终可见，导出正文不截断。

## 已完成：移动端键盘净空修复

### 产品契约

- 测量边界是包含加号、输入框、表情、麦克风和发送按钮的整块白色圆角 Composer 输入面底边。
- 键盘稳定打开后，输入面底边与真实键盘顶边保持 `8px` 可见净空。
- 这 `8px` 与 Composer 打开加号/表情功能面板时的既有 `mt-2` 呼吸间距一致。
- 键盘关闭时保留既有 `10px + env(safe-area-inset-bottom)`。
- 页面缩放策略属于独立产品决策；当前项目明确禁止双指缩放，不要在键盘任务中改写。

领域词汇和实现边界已经写入 `CONTEXT.md` 的 `Consistent Keyboard Clearance`。

### 真机根因

最初三端真实数据：

- Android Chrome：`VisualViewport` 缩小，Layout Viewport 保持稳定，需要上移 Composer。
- Via：Layout Viewport 与 Visual Viewport 一起缩小，`layoutViewportTracksKeyboard=true`，不能重复上移。
- iOS Chrome：`VisualViewport` 缩小，现有上移路径正确。

加入只在 `?viewport-debug=1` 生效的临时探针后，Android Chrome 证明：

- `visualViewport.height=579.2`
- 原始 `viewportKeyboardInset=346.3`
- 浏览器报告输入面仍有约 `7.7px` 净空
- 但真实键盘顶部比 `VisualViewport` 底边高约 `16px`
- 紫色输入面底边和青色净空探针均被键盘覆盖

因此根因不是 Composer 阴影，也不是 Via/PWA 包装差异，而是该 Android `resizes-visual` 环境在没有精确键盘几何 API 时少报告约 `16px` 顶部遮挡。

### 正式实现

主要入口：

```text
src/lib/useStableViewport.ts
src/index.css
test/keyboardClearance.test.ts
```

正式规则：

1. 安全上下文且浏览器支持 `VirtualKeyboard` 时，启用 `overlaysContent` 并优先使用 `boundingRect` 的真实键盘几何。
2. Android、无有效 `VirtualKeyboard` 几何、键盘已经打开、且 Layout Viewport 没有随键盘缩小时，对 Composer 位移增加已由真机证明的统一 `16px` 遮挡保护。
3. Layout Viewport 已随键盘缩小的 Via 路径保持 `0` 额外位移。
4. iOS 的准确 `VisualViewport` 路径不接受 Android 修正。
5. 只有键盘打开时 Composer 底部净空变为 `8px`；关闭时保持原安全区。

`resolveComposerBottomClearance()` 和 `resolveComposerKeyboardInset()` 是可测试的纯计算 seam。回归测试覆盖：

- Android Chrome 无精确几何时的 `346.3 + 16`
- VirtualKeyboard 精确几何优先于 VisualViewport 与 fallback
- Via layout-resize 不重复上移
- iOS 不接受 Android fallback
- 键盘关闭时不应用 fallback

### 验收与清理

- 用户已在 realme Android 15 + Chrome 150 真机确认“不遮挡了”。
- 修复前 Via 与 iOS 的 `8px` 净空已由截图和几何值确认；正式修复不改变这两条路径。
- 临时 `?viewport-debug=1` 面板、紫色轮廓、青色探针、阴影覆盖和采样代码已经全部删除。
- 普通页面和带旧调试查询参数的页面都不会再创建调试 UI。

### iOS 辅助条边界

- iOS 浏览器/PWA 的 `∧∨完成` 辅助条不是网页 DOM，CSS/JavaScript 无法隐藏。
- `Keyboard.setAccessoryBarVisible({ isVisible: false })` 只在 iPhone 的 Capacitor 原生壳内有效。
- 当前仓库没有 Capacitor 依赖、配置或 `ios/` 工程。
- 用户没有 macOS/Xcode，并已决定不引入 Capacitor；本轮没有添加任何原生依赖或无效兼容片段。

## 当前自动基线

```text
npm test
→ 148/148 通过

npm run typecheck:strict
→ 通过

npm run typecheck:server
→ 通过

npm run build
→ 通过，保留既有 500 kB Chunk Size Warning
```

`npm run build` 在 Windows 并行运行时可能因 `tsconfig.*.tsbuildinfo` 写入冲突出现 `EPERM`；生产构建应串行执行。

## 唯一剩余问题：后台后页面重载与状态恢复

### 已知表现

不论当前在哪个 Workspace，进入后台约 10 秒以上再返回时，页面可能重新加载并回到初始 Conversation 列表。用户希望返回时仍处于离开前的页面。

### 已确认边界

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

### 实施前必须确认的产品语义

- 只恢复同一标签页刷新，还是浏览器完全关闭后也恢复
- 恢复哪些状态：Workspace、子页面、线程、日期、Archive 模式、Timeline 模式、搜索页
- 是否恢复未发送草稿
- 是否恢复滚动位置
- 状态多久过期
- 已删除或失效的线程、日期和文档如何回退

不要默认把所有 Controller State 全量序列化。

### 推荐实施顺序

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

## 绝对不要再踩的坑

### 架构与持久化

- 不要把跨刷新恢复继续塞回 `App.tsx` 的零散 Effect。
- Workspace、ContentSync 和 View 不得直接查找全局 Service Registry 或自行读取基础设施配置。
- View 只通过 View Model 与 Commands 参与领域行为。
- 不要让 Workspace 互相读 Store；跨 Workspace 恢复目标仍走 App Navigation Intent。
- 不要建立通用 `GlobalStateRegistry`、`UniversalCache` 或全局 Event Bus。
- 不要持久化 Token、Header、Adapter Cause、Server 路径、原始 Error 或完整 Dependencies。
- 不要把 Canonical Snapshot、ContentSync Cache、Live Record、SSE Cursor 和 Mutation Overlay 不加区分地整体序列化。
- 不要在恢复时绕过 Workspace 对线程、日期和文档合法性的校验。
- 不要声称 `sessionStorage`、`localStorage` 或 IndexedDB 可以互相替换。

### 移动端键盘

- 不要把 Android 的 `16px` 遮挡保护改成全浏览器通用间距；它只在 Android、无精确 VirtualKeyboard 几何、键盘已打开且 Layout Viewport 未跟随键盘时生效。
- 不要再按 realme 型号、Chrome 版本或具体第三方键盘扩展补偿表。
- 不要只根据一次 `resize` 判断键盘状态；移动地址栏、旋转和 Visual Viewport 滚动都会触发相似变化。
- 不要把 `100vh`、`100dvh` 或 `visualViewport.height` 当作所有移动浏览器都一致的真实键盘边界。
- 不要更改已验收的 `8px` 键盘净空、关闭态安全区、输入框 DOM、Transcript 滚动、消息锚点或动画。
- 除非出现新的可复现真机证据，不要重新加入 viewport 调试面板。
- 不要为 iOS 浏览器/PWA 加入无效的 Capacitor 调用；只有用户明确恢复原生包装目标并具备 macOS/Xcode 环境时才重新讨论。

### 实施与验证

- 新增代码中确实需要的注释必须使用中文。
- 每个问题先补 Characterization/失败测试，再修改实现。
- 每个问题独立测试、独立构建、独立提交、独立回退。
- 不要顺便改 UI 风格、CSS 体系、动画、滚动或目录。
- Vite 500 kB Chunk Warning 是现有基线，不要误报成当前任务造成的失败。
- 移动端键盘问题不能仅凭 Node 测试宣称完成，必须记录真机结果；本次已记录用户验收。

## 建议后续状态恢复任务使用的技能

- `grilling`：在写代码前确认恢复范围、关闭浏览器后的语义、过期时间和隐私边界。
- `codebase-design`：设计最小的 Session Restore seam，保持 Composition Root、Navigation 和 Workspace 所有权。
- `tdd`：先锁定刷新前后目标状态与非法目标回退，再实现。

## 交接完成标准

新会话只要做到以下几点，就算正确接手：

- 不再重复架构迁移。
- 不重新打开已经真机验收完成的 Android 键盘任务，除非出现新的可复现证据。
- 不为 iOS 浏览器/PWA 添加无效原生调用。
- 在没有真实生命周期证据前，不猜后台页面重建原因。
- 在没有产品恢复语义前，不批量持久化 Controller State。
- 状态恢复修改保持中文必要注释、自动验证、真机验收和独立提交。
