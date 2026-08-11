# MurmurLane 当前架构总览

## 文档定位

本文档描述当前源码已经落地的架构，是理解 MurmurLane 代码所有权、运行时数据流和静态依赖方向的首要入口。

相关文档各自承担不同职责：

- `CONTEXT.md`：稳定领域词汇。
- `AGENTS.md`：开发与修改约束。
- `docs/adr/`：架构决策及其理由。
- `docs/architecture/migration-plan.md`：迁移顺序、测试和历史账本。
- [`docs/architecture/cross-repo-diagnosis.md`](cross-repo-diagnosis.md)：仓库内稳定入口；唯一权威诊断流程位于本地 [`../murmurlane-stack/docs/workflow/cross-repo-diagnosis.md`](../../../murmurlane-stack/docs/workflow/cross-repo-diagnosis.md)；GitHub：[main](https://github.com/Youxuuuuu/murmurlane-stack/blob/main/docs/workflow/cross-repo-diagnosis.md)。
- `HANDOFF.md`：当前会话的短期交接。

本文档不重复全部 ADR。需要理解某项选择为什么成立时，再阅读对应 ADR。

## 一句话架构

> Cyberboss 仓库提供权威 Conversation 生产契约（派生 Conversation Record 的具体生成与持久化在 `src/custom/xiaoye/conversation/`）；ContentSync 管理来源数据何时有效；Workspace 管理数据意味着什么以及页面如何响应；View 只负责展示和瞬时交互；Adapter 与 MurmurLane Server 只提供技术能力。

新增代码首先判断“这条规则由哪个领域或应用模块拥有”，而不是先根据 React、HTTP、文件类型或 Hook 决定目录。

## 系统所有权

```text
Cyberboss
├─ Runtime 与 Channel
├─ Thread 权威状态
├─ Canonical Conversation Record
├─ Conversation Archive 写入
└─ WebChat 生产契约

MurmurLane
├─ App：组合、导航和跨领域流程
├─ ContentSync：来源有效性与同步
├─ Workspace：领域状态、规则、View Model 与 Commands
├─ View：DOM、滚动、窗口化、手势和动画
├─ Browser Adapter：HTTP、SSE、上传、认证和协议校验
└─ Server：安全读取、白名单编辑和前端传输接口
```

MurmurLane 不直接调用 Codex 或 ClaudeCode Runtime，也不直接写入或删除 `conversations/*.jsonl`。

对应决策：

- ADR-0001：领域所有权优先于技术组织。
- ADR-0008：Cyberboss 生产，MurmurLane 消费。
- ADR-0015：运行时数据流与静态模块依赖必须分别判断。

## 运行时数据流

### 来源读取与页面展示

```text
Cyberboss Data Root
→ MurmurLane Server
→ MurmurLane Data Adapter
→ ContentSync Snapshot
→ Workspace 解释领域意义
→ View Model
→ View
```

ContentSync 只发布只读 Snapshot 与同步元数据。Workspace 不维护一份需要 Effect 手工同步的等价来源副本。

### Conversation 实时与归档

```text
Cyberboss WebChat
→ WebChat Adapter
→ Conversation Workspace Live State

Conversation Archive
→ ContentSync Canonical Snapshot

Canonical Records + Live Records
→ buildConversationTranscript(...)
→ Conversation View Model
→ Conversation View
```

Live Record 被对应 Canonical Record 替换时，Transcript 保持稳定 Display Identity 和 Render Identity，避免气泡无意义重挂载、动画重播或滚动锚点跳动。

### 领域写操作

```text
View 用户操作
→ Workspace Command
→ 窄 Adapter Port
→ MurmurLane Server 或 Cyberboss
→ Workspace Mutation/Transaction 结果
→ ContentSync 收到新 Canonical Snapshot
→ Workspace 对账并清除已确认 Overlay
```

View 不直接发送领域请求，也不根据 HTTP 状态码决定业务结果。

### 跨 Workspace 导航

```text
调用方表达 Navigation Intent
→ App Navigation 激活目标 Workspace 并转交 Target
→ 目标 Workspace 校验和解释 Target
→ View 执行滚动、高亮或视觉反馈
```

Workspace 不读取、调用或修改其他 Workspace 的内部状态。真正跨领域的业务编排进入 `src/app/flows/`。

## 静态依赖方向

允许的主要方向：

```text
main.tsx / App Composition Root
→ App Navigation、ContentSync、Workspace
→ Workspace 内部领域模块和窄 Port
→ 领域中立基础能力

Composition Root
→ 具体 Browser Adapter
→ 作为窄 Port 注入 ContentSync 或 Workspace

View
→ Workspace View Model 与 Commands
```

禁止的反向依赖：

```text
ContentSync → Workspace 业务规则
Workspace A → Workspace B 内部 Store
View → 具体 Adapter 或 ContentSync 内部实现
Workspace → import.meta.env、fetch、EventSource 或 DOM
Shared → Workspace、AppRoot 或具体 Adapter
Server Domain → Express Request/Response
```

静态依赖方向由 `test/architectureBoundaries.test.ts` 等测试锁定。

## App 层

主要位置：

```text
src/app/config/
src/app/composition/
src/app/navigation/
src/app/flows/
```

### Browser Config 与 Composition Root

`src/main.tsx` 通过 `createProductionDependencies(import.meta.env)` 创建生产依赖。浏览器公开配置在 `src/app/config/` 解析为只读快照，具体 Adapter 在 `src/app/composition/` 组装。

Composition Root 负责：

- 读取并校验浏览器公开配置。
- 创建 MurmurLane Data Adapter 与 WebChat Adapter。
- 将最小能力注入相应模块。
- 为测试允许注入 Fake Adapter。

它不拥有线程、日期、未读、搜索、对账、滚动或动画规则。

### App Navigation

`src/app/navigation/appNavigation.ts` 只管理：

- 当前激活的 Workspace。
- 类型明确的 Navigation Target。
- Target Revision 与消费确认。
- 未知 Workspace 等应用级错误。

目标是否合法、如何加载和如何展示，由目标 Workspace 决定。

### Application Flow

只有真正跨领域的应用流程进入 `src/app/flows/`。例如 Timeline 与 Archive 仍需要共享浏览日期时，由显式 Flow 组装，不允许两个 Workspace 互相调用。

对应决策：ADR-0003、ADR-0010、ADR-0015、ADR-0018。

## ContentSync

主要位置：

```text
src/content-sync/contentSyncService.ts
src/content-sync/sourceSnapshotStore.ts
src/content-sync/generation.ts
src/content-sync/liveUpdateCoordinator.ts
```

ContentSync 拥有：

- 启动加载与来源刷新。
- Content Source Snapshot。
- Keyed Source Cache 与 Negative Source Cache。
- Source/Key Generation。
- Snapshot Revision。
- 文件 SSE 的连接、事件去重、批处理和 `resync`。
- loading、error、updatedAt、connection 等同步元数据。
- 旧请求迟到时的逻辑拒绝。

ContentSync 不拥有：

- 当前页面、线程和业务日期。
- Live/Canonical 的领域对账意义。
- 未读、搜索和排序语义。
- Mutation Overlay。
- 页面 View Model。
- DOM、滚动和动画。

核心 seam 是只读 Snapshot 和窄刷新能力，而不是一个新的全局业务 Store。

对应决策：ADR-0002、ADR-0013、ADR-0017、ADR-0019。

## Workspace

Workspace 是领域规则、领域状态、View Model 和 Commands 的所有者。Controller 在 AppRoot 应用会话内持续存在，View 可以按当前页面结构挂载和卸载。

### Conversation Workspace

位置：`src/workspaces/conversation/`

拥有：

- 当前线程、日期和 Conversation 页面模式。
- Profile 领域状态。
- Live Records、WebChat Cursor 和 Draft Thread。
- 发送、上传、重试与 `sent / failed / unknown` 事务。
- Voice Draft、Voice Message Command、转写重试/人工确认、Speech Rendition Command 与相关失败恢复。
- 未读与通知。
- Conversation Navigation Target 的解释。
- Canonical 与 Live 对账。
- Conversation View Model 与 Commands。

Conversation Workspace 继续拥有唯一的 WebChat SSE 生命周期，并在收到事件后只进行一次领域分类。`src/workspaces/conversation/runtime/` 是 Workspace 内部 Runtime 消费模块，只通过已有 WebChat Port 消费 Runtime Snapshot 与 Commands；它不创建 EventSource 或第二条订阅。

Runtime 状态所有权遵循以下规则：

- Model、Provider、Effort、Context Usage 与 Thread Usage Totals 的权威所有者仍是 Cyberboss。
- `usageTotals` 在消费侧按 Thread 隔离，只向当前 Thread 暴露对应累计快照。
- `contextUsage` 只展示 `threadId` 与当前 Thread 匹配的最近 Runtime Snapshot，不与 `usageTotals` 合并或互相回退。
- 收起态 Runtime 状态条显示 `模型 · context 当前占用 / Runtime 实际窗口`，不显示 cache；Context 小于 10k 显示完整整数，否则使用 k。Codex 窗口消费 Runtime 报告值，ClaudeCode 窗口消费 Cyberboss 规范化的 200k / 显式 `[1m]` 1M 值。
- 展开态四格只读取 `usageTotals`；累计值按已确认的完整整数/k/m 阈值格式化。最近一轮 `in / out / cache` 读取 `contextUsage` 的 latest 字段并始终显示完整整数。
- Runtime Context Snapshot 当前不跨 Cyberboss 重启持久化；Cyberboss 不可用或重启后尚无新 Usage 时允许显示 0。MurmurLane 不读取 Raw Session、不使用浏览器持久化，也不把上次页面值伪装成实时 Context。
- Runtime 内部模块不持久化设置或 Usage，不自行累计 Token，也不拥有 Runtime Activity、Turn、审批或连接状态。
- `useConversationWorkspace` 继续拥有 Activity、Turn、审批、连接、消息和 SSE 生命周期，并将 Runtime 数据事件交给内部 Runtime 模块吸收。

唯一 Transcript 公共 seam：

```ts
buildConversationTranscript({
  canonicalRecords,
  liveRecords,
  threadId,
})
```

该 seam 统一负责：

- Canonical 替换 Live。
- 稳定展示身份。
- 排序与隐藏。
- 图片、文件、Sticker 和 Operation 分组。
- Assistant Turn 组织。
- 输出可渲染展示条目。

`src/lib/conversation*.ts` 目前继续保留原物理位置，但语义上属于 Conversation 领域内部实现，不是全应用 Shared。

Conversation 语音消费遵循以下边界：

- `useVoiceDraftRecorder` 只拥有当前页面内存中的 MediaRecorder/Voice Draft 生命周期；松手不上传，显式发送才交给 Workspace Command。
- `meta.voiceMessage` 与 `meta.speechRendition` 是 Cyberboss 生产事实；Workspace 负责安全解析、Live/Canonical 稳定身份和失败恢复，不在页面推断 processing 状态。
- `AudioPlaybackCoordinator` 是当前 Conversation 页面 Voice Draft、Voice Message 与 Speech Rendition 的单音频协调 seam；新播放暂停旧播放并保留旧进度，展开和对账不得重挂载音频。
- `VoiceMessageBubble`、`SpeechRenditionControl` 与 `VoiceComposerBar` 是正式页和 `/dev/voice-ui` Preview 复用的生产组件，不存在第二套 Preview 播放器或 Composer。
- 装饰波形只表达可点击的真实播放进度，不生成、保存或消费声学 peaks。
- Runtime 模型面板不展示 Voice Input Provider、模型或“可用”技术元数据；Composer 仍按 WebChat status capability fail closed。

### Timeline Workspace

位置：`src/workspaces/timeline/`

拥有：

- Timeline 页面模式、日期和月份。
- Event 分类、排序与搜索语义。
- 保存和删除 Commands。
- Timeline Mutation Overlay。
- 失败、回滚、冲突和等待同步状态。
- Timeline View Model。

读取路径：

```text
ContentSync Canonical Timeline Snapshot
+ Timeline Mutation Overlay
→ Effective Timeline State
→ 页面、搜索和日期可用性
```

### Archive Workspace

位置：`src/workspaces/archive/`

拥有：

- Diary、Letters、Memory、Open Loops 等内容语义。
- Archive 日期、模式、文档身份和搜索。
- 保存 Commands。
- Archive Mutation Overlay。
- 草稿、失败回退和等待同步。
- Archive View Model。

Timeline 与 Archive 即使存在形状相似的选择、搜索和 Mutation，也不因此合并为通用 Workspace 框架。

对应决策：ADR-0004、ADR-0005、ADR-0006、ADR-0012、ADR-0014。

## View

View 只接收：

```text
View Model
+ Commands
```

View 拥有：

- JSX、CSS 和视觉组件。
- DOM refs。
- 滚动、锚点和窗口化。
- Framer Motion 与动画 Ledger。
- 触摸、左滑和局部展开。
- 输入焦点、图片预览和视觉计时器。

View 不负责：

- 直接请求领域数据。
- 修改 ContentSync Snapshot。
- Live/Canonical 对账。
- 决定 Mutation 是否提交或回滚。
- 根据技术 Error Class 或 HTTP 状态码决定业务行为。

Controller 可以表达“定位某条消息”等展示意图，但具体滚动、高亮和动画由 View 执行。

## Browser Adapter 与错误流

具体生产 Adapter 目前主要建立在：

```text
src/data/api.ts
src/data/chatApi.ts
```

它们负责：

- HTTP、EventSource、URL 和认证 Header。
- Token Query、Timeout、Abort 和上传。
- 媒体 URL。
- Voice Message 二进制上传、转写重试/确认与 Speech Rendition 请求。
- 外部 `unknown` 数据的运行时校验。
- 技术错误归一化。

错误流：

```text
Adapter Technical Error
→ Workspace 解释为领域结果与恢复动作
→ View Model 生成安全用户状态
→ View 按现有 UI 渲染
```

View Model 不暴露 Token、原始 Server Body、绝对路径、Stack 或 Adapter Cause。

对应决策：ADR-0009、ADR-0010、ADR-0014、ADR-0018。

## MurmurLane Server

主要结构：

```text
server/index.ts
→ 环境配置、生产依赖、listen、进程生命周期

server/app.ts
→ 创建 Express、组装领域模块

server/routes.ts
→ HTTP 参数、响应和错误映射

server/conversation/
server/memory/
server/media/
server/reminder/
server/readModels/
→ 不依赖 Express 的领域读取模块

server/fileLoaders.ts
→ Data Root 与安全文件访问能力
```

Server 规则：

- Conversation Archive 只读。
- Timeline 与 Memory 只通过现有白名单编辑。
- 文件与媒体受 Data Root、路径和大小限制。
- Live Update 模块发布普通变化事件，SSE Router 负责传输格式。
- 领域错误由 Router 映射为既有 HTTP 状态和 JSON。

对应决策：ADR-0007、ADR-0009、ADR-0014、ADR-0018。

## 状态与派生值

| 语义 | 权威所有者 |
| --- | --- |
| Canonical 来源数据、Source Cache、同步元数据 | ContentSync |
| 当前线程、日期、页面模式和用户意图 | 对应 Workspace |
| Live Records、发送事务、Mutation Overlay | 对应 Workspace |
| Transcript、View Model、排序、计数和展示分组 | 确定性派生值 |
| 搜索文档和索引 | 对应 Workspace 的可丢弃性能缓存 |
| DOM、滚动、动画、窗口范围和焦点 | View |
| 文件解析与读取缓存 | 对应 Server 领域模块 |

性能缓存必须可丢弃、可重建，具有完整输入 Key 和明确失效规则，不得成为竞争性的业务事实来源。

对应决策：ADR-0013、ADR-0017、ADR-0019。

## 共享代码准入

代码默认留在拥有其规则的 Workspace 或应用模块。只有同时满足以下条件才提取共享能力：

- 领域中立。
- 语义稳定。
- 已存在至少两个独立真实消费者。
- 提取后不需要大量领域策略参数。
- 不会成为跨 Workspace 隐式通信通道。

当前不建立顶层 `shared/`、`common/`、`utils/` 或通用 Workspace/Mutation/Selection 框架。

对应决策：ADR-0016。

## 新功能投放判断

| 新规则或能力 | 默认位置 |
| --- | --- |
| Conversation 展示、线程、未读、发送、对账 | `src/workspaces/conversation/` |
| Timeline 分类、搜索、编辑和日期规则 | `src/workspaces/timeline/` |
| Diary、Memory、Letters、Open Loops 语义 | `src/workspaces/archive/` |
| 跨 Workspace 跳转 | `src/app/navigation/` |
| 真正跨领域业务编排 | `src/app/flows/` |
| 来源加载、缓存、文件变化和重同步 | `src/content-sync/` |
| HTTP、SSE、上传、认证和媒体 URL | 具体 Adapter |
| DOM、滚动、窗口化、手势和动画 | 对应 View |
| Server 安全读取与白名单编辑 | 对应 `server/` 领域模块 |
| Cyberboss Runtime、Channel 或 Canonical 契约 | Cyberboss 仓库，并建立跨仓库任务 |

如果一条规则无法明确放入上表，先确认其语义所有者，不要先创建新的通用目录或全局 Store。

## 当前实施与验证状态

截至 2026-08-12：

- ADR-0001 至 ADR-0019 均为 `Status: Accepted`、`Implementation: Complete`。
- 架构迁移和统一浏览器/真机验收已完成。
- 真机验收发现的迁移回归和 MurmurLane 局部 UI 问题已经独立修复并由用户确认。
- realme Android Chrome 的键盘遮挡已经通过真实 Viewport/Composer 几何诊断、纯函数回归测试和三端分流修复，并由用户真机确认。
- iOS 浏览器/PWA 的系统键盘辅助条不属于网页可控 UI；用户决定不引入当前 Windows 环境无法构建验证的 Capacitor iOS 原生壳。
- 当前剩余的“后台页面重建恢复”是新增持久化能力。
- 该后续问题不阻塞架构迁移完成状态。
- Conversation Runtime 面板已分离 `contextUsage` 与 `usageTotals`，兼容 ClaudeCode/Codex 当前 Token 事件并落实 Context 窗口与数值格式规则；Context Snapshot 跨 Cyberboss 重启持久化由用户决定暂不实施，不阻塞当前功能完成状态。
- WebChat 异步语音已完成桌面生产纵切面：内存 Voice Draft 显式发送、cloud Voice Bubble、页面级单音频协调、Qwen 转写/复核/重试、Assistant Voice Message 与 Speech Rendition 均已接线并由用户桌面实测；受信任局域网 HTTPS 手机录音仍待人工验收。
- Voice Input Provider、模型与“可用”状态不在 Runtime 模型面板展示；该展示决定不改变内部 capability 或后端契约。

当前自动基线：

```text
npm test
→ 195/195 通过

npm run typecheck:strict
→ 通过

npm run typecheck:server
→ 通过

npm run build
→ 通过，保留既有 500 kB Chunk Size Warning
```
