# MurmurLane 架构迁移执行计划

## 文档用途

本文档是 ADR-0001 至 ADR-0019 的实施顺序与执行账本。

架构迁移必须按照本文档逐阶段进行。每个阶段完成后更新：

- 阶段状态
- 实际修改文件
- Characterization Tests
- 自动验证结果
- 人工验收结果
- 已知风险
- 对应 ADR 的 `Implementation` 状态

不得依赖聊天记录记忆执行顺序，也不得因为后续阶段更方便而提前搬迁其职责。

## 全程约束

- 一次只迁移一个 seam。
- Characterization Tests 必须先于调用链迁移。
- 每个阶段必须可以独立构建、验证、提交和回退。
- 行为保持型迁移不得无意改变 UI、CSS、DOM、React Key、滚动、窗口化、手势或动画。
- 有意行为变化必须独立实施并明确列出允许变化。
- 不夹带新功能、无关重命名、全树目录搬迁或格式化噪音。
- 新 seam 默认使用严格类型。
- 代码中确实需要的注释统一使用中文；不为直观代码增加重复性注释。
- 不引入 Redux、Zustand、通用依赖注入框架、Service Locator、全局 Event Bus 或通用 Repository。
- 每个阶段完成自动验证与 Diff 检查后必须立即创建独立 Git Commit。
- 后续阶段可以连续执行，但必须保持一次迁移一个 seam，不得跨阶段混合修改或提交。

## 验收节奏

架构迁移期间采用两层验收：

### 每阶段必须完成

- 对应 seam 的 Characterization Tests
- 受影响范围测试
- 完整 `npm test`
- 新 seam 严格类型检查
- 应用或 Server 对应类型检查
- 正式生产构建
- Diff 与依赖方向检查
- 确认没有无意修改 JSX、CSS、DOM、React Key、滚动、窗口化和动画
- 创建独立 Git Commit

### 全部架构迁移完成后统一执行

- 浏览器完整交互回归
- 手机真机交互回归
- 滚动、锚点、窗口化和历史加载
- 输入法、软键盘、焦点与移动端输入行为
- Touch、左滑和预览交互
- Framer Motion 与气泡动画
- Live Record 到 Canonical Record 替换
- WebChat 实时连接、发送、上传和重试

延后真机验收不会降低每阶段自动验证要求。最终验收发现问题时，应根据阶段提交定位并只回退或修复对应 seam。

## 阶段总览

| 阶段 | Seam | 状态 | 主要 ADR |
| --- | --- | --- | --- |
| 1 | Conversation Transcript | Implemented / Final Device Pending | ADR-0006、0009、0011、0019 |
| 2 | Browser Config、Composition Root 与最小 Adapter | Implemented / Final Device Pending | ADR-0009、0010、0015、0018 |
| 3 | ContentSync | Implemented / Final Device Pending | ADR-0001、0002、0013、0017、0019 |
| 4 | Conversation Workspace Controller | Implemented / Final Device Pending | ADR-0005、0006、0012、0014、0017 |
| 5 | App Navigation | Implemented / Final Device Pending | ADR-0003、0010、0015 |
| 6 | Timeline 与 Archive Workspace | Implemented / Final Device Pending | ADR-0005、0013、0014、0019 |
| 7 | 搜索所有权 | Pending | ADR-0004、0011、0016 |
| 8 | Server 分层与 Server Typecheck | Pending | ADR-0007、0009、0014、0018 |
| 9 | 严格类型收尾 | Pending | ADR-0009、0011 |

## 阶段 1：Conversation Transcript

### 目标

建立唯一公共入口：

```ts
buildConversationTranscript({
  canonicalRecords,
  liveRecords,
  threadId,
}): ConversationTranscript
```

该 seam 统一承载从 Canonical 与 Live Records 到可渲染 Conversation 展示语义的确定性规则。

### 执行顺序

1. 阅读当前 `ConversationPage.tsx` 的真实组合顺序与现有纯逻辑测试。
2. 补充 Transcript Characterization Tests，并确认测试在新 seam 尚不存在时失败。
3. 建立严格类型的 Transcript 模块和窄公共入口。
4. 复用现有 `conversationMerge`、`conversationIdentity`、`conversationDisplayGroups`、`conversationMediaDisplay` 与 `assistantTurnModel`，不复制实现。
5. 将 `ConversationPage.tsx` 的 Record 合并、隐藏和展示分组调用收敛到 Transcript seam。
6. 保留窗口化、DOM、滚动、动画、搜索定位和 Assistant Turn 的视口切片逻辑在 View。
7. 运行相同 Characterization Tests、现有测试、严格检查和生产构建。
8. 检查 Diff，确认 JSX、CSS、DOM 和 React Key 没有无意变化。

### 完成条件

- Canonical 与 Live 合并结果不变。
- Canonical 替换 Live 的稳定身份不变。
- 排序与隐藏结果不变。
- Operation、图片、文件和 Sticker 分组顺序不变。
- Assistant Turn 输入结构不变。
- 相同输入产生相同 Transcript。
- `ChatBubble` 与 `AssistantTurn` 不修改。
- JSX、CSS、DOM、滚动、窗口化和动画时序不变。
- `npm test` 通过。
- 新 seam 的严格类型检查通过。
- `npm run build` 通过。

## 阶段 2：Browser Config、Composition Root 与最小 Adapter

### 目标

- 建立 Browser Config Parser。
- 通过 Composition Root 创建生产 Adapter。
- 使用窄 Port 将能力传给后续模块。
- 保持 `api.ts` 与 `chatApi.ts` 的现有协议行为。

### 完成条件

- API URL、Header、Token、Query、Timeout、上传和媒体 URL 不变。
- `main.tsx` 保持轻量。
- AppRoot 不拥有领域规则。
- Workspace 与 ContentSync 不直接读取 `import.meta.env`。
- Fake Adapter 测试不需要修改全局环境变量。
- 测试、严格检查与构建通过。

## 阶段 3：ContentSync

### 目标

- 迁移启动加载、Source Cache、Negative Cache、文件 SSE、失效刷新和重同步。
- 建立 Source/Key Generation 与 Snapshot Revision。
- 发布只读 Snapshot 和同步元数据。

### 完成条件

- 当前启动加载结果与刷新范围不变。
- 文件 SSE 去重、短延迟批处理、页面隐藏和恢复 `resync` 行为不变。
- 旧请求不会覆盖新 Snapshot。
- 不同 Source 与 Key 可以独立并行。
- `remoteSearchCacheState` 按真实语义完成分类，不被整体删除。
- Workspace 只读消费 Snapshot。
- 测试、严格检查与构建通过。

## 阶段 4：Conversation Workspace Controller

### 目标

迁移 Conversation 的领域状态、View Model 与 Commands，包括：

- 当前线程、日期和业务页面模式
- Live Records
- WebChat Cursor
- Draft Thread
- 发送、上传和 Staged Send 事务
- Profile
- 未读与通知
- 请求状态和领域错误
- Transcript 派生与导航 Target 解释

### 完成条件

- Controller 在应用会话中持续存在。
- WebChat 活动条件、订阅与关闭时机不变。
- `requestId`、Cursor、发送 `failed/unknown` 和 Draft Thread 语义不变。
- 未读在完成 Characterization 前不被机械改写。
- View 只接收 View Model 与 Commands。
- View 继续拥有 DOM、滚动、窗口化、手势和动画。
- 测试、严格检查与构建通过。

## 阶段 5：App Navigation

### 目标

- 建立类型明确的 Navigation Intent。
- App Navigation 只激活 Workspace 并转交 Target。
- 目标 Workspace 自己校验和解释 Target。

### 完成条件

- Workspace 不读取或修改其他 Workspace 内部状态。
- 当前页面切换和目标定位结果不变。
- 未知 Workspace 使用应用级错误处理。
- 不把 Conversation 领域规则放进 App Navigation。
- 测试、严格检查与构建通过。

## 阶段 6：Timeline 与 Archive Workspace

Timeline 与 Archive 分开迁移，形成两个独立可回退单元。

### Timeline

- 迁移选择、页面流程、Mutation Overlay 和 Effective Timeline State。
- 页面、搜索和日期可用性从同一 Effective State 派生。
- 保持保存、删除、失败和刷新行为。

### Archive

- 迁移 Diary、Memory、Letters、Open Loops 的状态与 Commands。
- 建立对应 Mutation Overlay 和 Effective Archive State。
- 保持草稿、回滚、错误位置和等待同步行为。

### 完成条件

- 不再通过多份等价状态手工同步同一 Mutation 结果。
- Date Index 仍是独立 Content Source。
- 不合并 Timeline 与 Archive 领域模型。
- 测试、严格检查与构建通过。

## 阶段 7：搜索所有权

这是独立的有意行为变化。

唯一允许变化：

```text
Conversation 只搜索 Conversation
Timeline 只搜索 Timeline
Archive 只搜索 Archive
```

### 完成条件

- 各 Workspace 拥有自己的 Query、Scope、排序和结果解释。
- 来源数据、派生索引、当前 Query 和结果列表具有明确分类。
- 搜索框 JSX、样式、动画、输入、高亮和点击反馈不变。
- 测试、严格检查与构建通过。

## 阶段 8：Server 分层与 Server Typecheck

### 目标

- 先补现有 HTTP、SSE、安全、编辑与缓存 Characterization Tests。
- 建立 Server Config Parser。
- 建立 `createApp(dependencies)`。
- 将 Router、领域模块、Server Access 与 Live Update 传输拆开。
- 建立独立 `tsconfig.server.json`。

### 完成条件

- 所有 URL、Query、Body、JSON、状态码和错误结构不变。
- CORS、静态托管、生产启动和优雅关闭不变。
- 编辑权限、路径边界、媒体限制和缓存语义不变。
- Conversation Archive 保持只读。
- `server/index.ts` 只承担配置、启动和进程生命周期。
- Server Typecheck、测试与构建通过。

## 阶段 9：严格类型收尾

### 顺序

```text
新 seam 默认严格
→ Server 独立 typecheck
→ Conversation Transcript 与 Workspace 职责迁出
→ 移除 ConversationPage.tsx 的 @ts-nocheck
→ App.tsx 职责迁出
→ 最后处理 App.tsx 的 @ts-nocheck
```

### 完成条件

- 不通过新增 `any`、无校验断言或 `@ts-nocheck` 绕过 seam。
- 不以移除类型错误为理由改变数据兼容、UI、DOM、滚动或动画。
- 是否启用全项目 `strict: true` 另行评估，不是本计划的强制完成条件。

## 每阶段交付报告

每个阶段结束时必须报告：

- 迁移前 Characterization Tests
- 新增测试范围
- 修改文件
- 明确保留的行为
- 有意行为变化
- 自动测试
- 严格类型检查
- 生产构建
- 人工验收清单与结果
- 已知未覆盖风险
- 对应 ADR Implementation 状态

## 执行日志

### 2026-07-27

#### 补救执行顺序

前一轮阶段 2 至阶段 6 只建立了部分 seam，不满足对应 ADR 的完整完成条件。后续不得直接从阶段 8 继续，而按以下顺序补齐：

1. 完成 Browser Config 与 Composition Root，移除旧 Adapter 的模块级配置查找和 View/Workspace 直接基础设施依赖。
2. 完成 ContentSync Snapshot、启动加载、Keyed Source Cache、Negative Cache 与只读发布所有权。
3. 完成 Conversation Workspace 的线程、日期、Profile、未读、通知、页面模式与 Navigation Target 所有权。
4. 完成 App Navigation Target 由目标 Workspace 校验、消费与清除的流程。
5. 完成 Timeline 与 Archive Controller、Commands、Mutation Overlay 和错误恢复所有权。
6. 重新核对 Reminder 等搜索数据的领域所有权，只在证据明确后将 ADR-0004 保持为 `Complete`。
7. 补齐 ADR-0013、ADR-0014 与 ADR-0016 的 Snapshot、错误流和共享代码准入实现缺口。
8. 实施 Server 分层、Server Config Parser、`createApp(dependencies)` 与独立 Server Typecheck。
9. 按 ADR-0009 的顺序移除 `ConversationPage.tsx` 和 `App.tsx` 的 `@ts-nocheck`，不强制一次性开启全项目 strict。
10. 运行最终全量自动验证，审计全部 ADR Implementation 状态，再执行统一浏览器和真机验收。

每个补救项继续遵守 Characterization Tests 先行、一次一个 seam、独立构建、独立提交和独立回退。任何仍为 `Partial` 的 ADR 不得被描述为已经完成。

#### 补救 A 执行结果：Browser Config 与 Composition Root

- `src/data/api.ts` 与 `src/data/chatApi.ts` 已改为由 Composition Root 使用显式配置创建的具体 Adapter，不再在模块初始化时读取环境变量。
- 运行时代码中只有 `main.tsx` 和 `registerServiceWorker.ts` 继续在允许的启动边界读取 `import.meta.env`。
- App、Workspace、View 与确定性搜索逻辑不再直接导入或创建具体网络 Adapter；页面通过窄 Command、加载函数与媒体 URL Port 使用能力。
- Browser Public Config 只把最小配置传给对应 Adapter；App 依赖只暴露 Adapter 与只读诊断开关，不暴露凭据或完整配置。
- API URL、认证 Header、EventSource Query、媒体 URL、15 秒发送 Timeout 与 120 秒上传 Timeout 保持不变。
- 修复前一阶段拆分 View Model 与 Commands 时遗留的 Composer 条件判断，使其继续依据 `webChatCommands` 显示；这属于恢复迁移前行为，不是产品行为变更。
- 新增 Data Adapter 与 WebChat Adapter Factory Characterization Tests；阶段相关测试 17/17 通过。
- 完整 `npm test`：100/100 通过。
- `npm run typecheck:strict`：通过。
- `npx tsc -p tsconfig.app.json --noEmit --incremental false`：通过。
- `npm run build`：通过；既有的 500 kB Chunk Size Warning 未处理。
- `git diff --check` 与依赖方向搜索通过。
- 本补救项未修改 CSS、DOM 层级、React Key、滚动、窗口化、手势或动画。
- ADR-0010 的浏览器 Composition Root 目标已完成，更新为 `Complete`。
- ADR-0018 仍为 `Partial`：浏览器配置边界已完成，Server Config Parser 与 Server Capability 注入留在补救项 8。
- 浏览器和真机完整交互验收仍按计划在全部架构迁移完成后统一执行。

#### 补救 B 执行结果：ContentSync

- 新增严格类型的 ContentSync Store 与 Service，由其持有来源 Snapshot、Keyed Source Cache、Negative Source Cache、Source Metadata、Snapshot Revision、Source/Key Generation 和文件连接状态。
- 启动加载、当前日期加载、Conversation 历史 Key 加载、搜索所需来源加载、文件事件失效范围、重连 `resync`、重试与过期结果丢弃均收口到 ContentSync。
- Conversation Archive、Timeline、Diary、Daily Summary、Letters、Static Memory、Xiaoye、Reminder History、Date Index、Conversation Profiles 与 Moments 的读取调用不再散落在 `App.tsx` 或 Workspace。
- `App.tsx` 只在 AppRoot 生命周期创建并持有 ContentSync，通过 `useSyncExternalStore` 消费只读 Snapshot，并表达当前日期、搜索激活和页面可见性等外部输入。
- `remoteSearchCacheState` 已按语义拆分：额外加载的原始来源数据进入 ContentSync Keyed Source Cache，已确认缺失的数据进入独立 Negative Source Cache。
- Profile 消费改为响应 ContentSync Snapshot，不再自行发起重复读取或使用全局浏览器事件刷新。
- 文件 SSE 仍保持 220ms 批处理、事件身份去重、页面隐藏关闭、恢复 `resync` 和无 Cursor 协议；连接状态进入 Snapshot。
- 同一 Source/Key 的旧请求不会覆盖新结果；不同 Source 与 Key 仍可独立并行；加载失败保留最后一份有效 Snapshot。
- 新增 4 个 Snapshot、Revision、Keyed/Negative Cache 与连接状态 Characterization Tests；ContentSync 相关测试 7/7 通过。
- 完整 `npm test`：104/104 通过。
- `npm run typecheck:strict`：通过。
- `npx tsc -p tsconfig.app.json --noEmit --incremental false`：通过。
- `npm run build`：通过；既有的 500 kB Chunk Size Warning 未处理。
- 来源读取依赖方向审计通过：除具体 Adapter 外，只有 `content-sync/` 调用来源读取 Port。
- 本补救项未修改 JSX、CSS、DOM、React Key、滚动、窗口化、手势或动画。
- ADR-0001、ADR-0002、ADR-0017 与 ADR-0019 的 ContentSync 部分完成；其中 Workspace、Mutation Overlay 与领域 Command 部分仍按后续补救项实施，整体状态不提前标为 `Complete`。
- ADR-0013 仍为 `Pending`，将在 Timeline、Archive 与 Conversation 写入流程形成领域 Overlay 后完成。
- 浏览器和真机完整交互验收仍按计划在全部架构迁移完成后统一执行。

- ADR-0001 至 ADR-0019 已确认。
- 迁移计划已写入本文档。
- 阶段 1 已建立 `src/workspaces/conversation/` 公共 seam。
- 新增 `buildConversationTranscript(...)` 与 Transcript 窗口选择接口。
- `ConversationPage.tsx` 已改为通过 Transcript seam 获取 Records、Render IDs 和窗口 Display Items。
- `ChatBubble`、`AssistantTurn`、JSX、CSS、DOM、React Key、滚动和动画代码未修改。
- 新增 4 个 Transcript Characterization Tests。
- 为新 seam 建立 `tsconfig.strict.json` 和 `typecheck:strict`。
- 为严格检查补齐现有 Conversation 纯逻辑中的明确类型，不改变运行逻辑。
- `npm test`：84/84 通过。
- `npm run typecheck:strict`：通过。
- `npx tsc -p tsconfig.app.json --noEmit --incremental false`：通过。
- `npm run build`：通过。
- 生产构建仍有迁移前已存在的 500 kB Chunk Size Warning，本阶段未处理。
- 浏览器和真机完整交互验收按用户决定延后到全部架构迁移完成后统一执行。

### 阶段 1 实际修改文件

```text
AGENTS.md
docs/adr/0006-conversation-transcript-is-the-single-display-seam.md
docs/adr/0009-strict-types-grow-from-new-seams.md
docs/adr/0011-migrations-are-characterized-one-seam-at-a-time.md
docs/adr/0015-runtime-flow-and-static-module-dependencies-are-distinct.md
docs/adr/0019-each-semantic-fact-has-one-authoritative-owner.md
docs/architecture/migration-plan.md
package.json
src/components/conversation/ConversationPage.tsx
src/lib/conversation.ts
src/lib/conversationDisplayGroups.ts
src/workspaces/conversation/buildConversationTranscript.ts
src/workspaces/conversation/index.ts
test/conversationTranscript.test.ts
tsconfig.strict.json
```

### 阶段 1 人工验收清单

- 打开已有归档 Thread，确认初始消息、日期分隔与底部定位不变。
- 切换包含长历史的 Thread，确认窗口化和历史加载不跳动。
- 接收 Live Assistant 消息，确认气泡只播放一次入场动画。
- 等待同一消息被 Canonical Record 替换，确认气泡不重新挂载或重播动画。
- 检查 Thinking、Operation、Assistant Turn 的顺序与展开表现。
- 检查连续图片、文件和 Sticker 的分组与顺序。
- 使用搜索结果定位消息，确认滚动、锚点和高亮不变。
- 加载更早和更晚日期，确认高度补偿与当前位置保持。

### 阶段 2 执行结果

- 新增 `parseBrowserConfig(...)`，锁定同源 API、开发 WebChat 地址、Token 空白处理和现有 Timeout。
- 新增只读 `AppDependencies`、`MurmurLaneDataAdapter` 与 `WebChatAdapter`。
- `main.tsx` 通过 `createProductionDependencies(import.meta.env)` 创建应用依赖。
- `App.tsx` 改为接收注入的数据 Adapter，不再直接导入 `src/data/api.ts`。
- 现有 `api.ts` 与 `chatApi.ts` 的 URL、Header、Token、Query、Timeout、上传、媒体 URL 和 SSE 实现未修改。
- `useWebChat.ts` 和其他旧调用方仍直接导入具体 Adapter，随对应 Workspace seam 迁移；ADR-0010 因此为 `Partial`。
- `api.ts`、`chatApi.ts` 和现有诊断调用方仍存在模块级 Build Env 读取，待调用方迁移后收口；ADR-0018 因此为 `Partial`。
- 新增 4 个 Browser Config 与 Composition Root Characterization Tests。
- `npm test`：88/88 通过。
- `npm run typecheck:strict`：通过。
- `npx tsc -p tsconfig.app.json --noEmit --incremental false`：通过。
- `npm run build`：通过。
- 生产构建仍有既有的 500 kB Chunk Size Warning，本阶段未处理。
- 本阶段未修改 JSX、CSS、DOM、滚动、窗口化或动画。
- 浏览器和真机完整交互验收继续延后到全部架构迁移完成后统一执行。

### 阶段 2 实际修改文件

```text
AGENTS.md
docs/adr/0010-adapters-are-wired-at-the-app-composition-root.md
docs/adr/0018-browser-public-config-and-server-secrets-have-separate-boundaries.md
docs/architecture/migration-plan.md
src/App.tsx
src/app/composition/appDependencies.ts
src/app/composition/createProductionDependencies.ts
src/app/config/browserConfig.ts
src/main.tsx
test/appComposition.test.ts
test/browserConfig.test.ts
tsconfig.strict.json
```

### 阶段 2 最终人工验收项

- 启动默认开发环境，确认 MurmurLane API 仍使用同源地址。
- 未设置 WebChat URL 时，确认开发环境仍连接 `http://127.0.0.1:8791`。
- 设置现有编辑凭据后，确认编辑能力显示条件不变。
- 进入 Conversation Chat，确认 WebChat 状态、发送、上传、SSE 和媒体 URL 行为不变。
- 在无凭据环境启动，确认原有只读与错误提示行为不变。

### 阶段 3 执行结果

- 新增 `createContentSyncGeneration()`，按 Source/Key 独立管理请求 Generation。
- 新增 `createLiveUpdateCoordinator()`，统一管理文件 SSE 订阅、事件身份去重、220ms 批处理、页面隐藏释放和恢复 `resync`。
- `App.tsx` 的文件 SSE Effect 已改为使用 ContentSync coordinator。
- 文件事件触发的 Conversation、Timeline、Memory、Reminder、Moment 和 Date Index 刷新，在提交前检查对应 Generation。
- Adapter 仍只负责创建与关闭 SSE；是否订阅、何时 `resync` 和迟到结果能否提交由 ContentSync 决定。
- 来源 Snapshot 的 React State、启动加载和搜索 Keyed Source Cache 仍在 `App.tsx`，将在后续所有权迁移中继续收口；ADR-0002 与 ADR-0017 因此为 `Partial`。
- 新增 3 个 ContentSync Characterization Tests。
- `npm test`：91/91 通过。
- `npm run typecheck:strict`：通过。
- `npx tsc -p tsconfig.app.json --noEmit --incremental false`：通过。
- `npm run build`：通过。
- 生产构建仍有既有的 500 kB Chunk Size Warning，本阶段未处理。
- 本阶段未修改 JSX、CSS、DOM、滚动、窗口化或动画。
- 浏览器和真机完整交互验收继续延后到全部架构迁移完成后统一执行。

### 阶段 3 实际修改文件

```text
AGENTS.md
docs/adr/0002-content-sync-validity-workspaces-meaning.md
docs/adr/0017-async-results-are-committed-by-their-state-owner.md
docs/architecture/migration-plan.md
src/App.tsx
src/content-sync/generation.ts
src/content-sync/index.ts
src/content-sync/liveUpdateCoordinator.ts
test/contentSync.test.ts
tsconfig.strict.json
```

### 阶段 3 最终人工验收项

- 应用可见时确认只建立一个文件 SSE。
- 连续触发同一文件事件，确认只发生一次有效刷新。
- 页面隐藏时确认文件 SSE 关闭，恢复时确认重新连接并执行完整 `resync`。
- 搜索进行时触发文件变化，退出搜索后确认积压事件刷新。
- 快速切换日期并触发刷新，确认迟到结果不覆盖较新来源数据。
- 断开并恢复 Server，确认保留最后有效数据并在重连后重新同步。

### 阶段 4 执行结果

- 将 `src/lib/useWebChat.ts` 迁入 `src/workspaces/conversation/useConversationWorkspace.ts`。
- Conversation Workspace 通过自己声明的 `WebChatPort` 接收状态、模型、发送、上传和订阅能力，不再导入具体 `chatApi.ts`。
- `WebChatPort` 只声明真实使用的能力，不暴露 Base URL、Token、Header、EventSource 或完整应用依赖。
- Conversation 的当前线程、日期、页面模式、Profile、Draft Thread、未读和通知状态已进入持续挂载的 Workspace Controller。
- Controller 只读消费 ContentSync Snapshot，并在内部派生线程列表、日期范围、页面模型和 Transcript；`App.tsx` 不再保存这些 Conversation 领域状态的等价副本。
- Workspace 输出拆分为 `viewModel` 与 `commands`；View 继续负责 DOM、滚动、窗口化、手势、焦点和动画。
- `ConversationPage` 不再自行组合 Canonical 与 Live Records，而只消费 Controller View Model 中的 Transcript。
- 现有 `requestId`、Message ID、Cursor、Draft Thread、Live Records、Usage、发送事务、上传准备和 `failed/unknown` 恢复流程保持原实现。
- Hook 继续由持续挂载的 `App.tsx` 无条件调用，View 条件卸载不会清空其领域状态。
- Navigation Target 的转交与解释留在阶段 5；Timeline 与 Archive Controller 留在阶段 6，因此 ADR-0003、ADR-0005 和 ADR-0012 的整体状态仍按各自剩余范围保持 `Partial`。
- 新增 Workspace 状态 Characterization Tests，覆盖线程选择、未读清理、通知队列和 Draft Thread 原子迁移，并复用现有 WebChat 事务、上传、状态和身份测试。
- `npm test`：107/107 通过。
- `npm run typecheck:strict`：通过。
- `npx tsc -p tsconfig.app.json --noEmit --incremental false`：通过。
- `npm run build`：通过。
- 生产构建仍有既有的 500 kB Chunk Size Warning，本阶段未处理。
- 本阶段未改变 JSX 生成结果、CSS、DOM 层级、React Key、滚动、窗口化或动画。
- 迁入 Workspace 文件中的必要代码注释已统一使用中文。
- 浏览器和真机完整交互验收继续延后到全部架构迁移完成后统一执行。

### 阶段 4 实际修改文件

```text
AGENTS.md
docs/adr/0005-workspaces-drive-views-through-models-and-commands.md
docs/adr/0012-controllers-outlive-views-within-the-app-session.md
docs/architecture/migration-plan.md
src/App.tsx
src/app/composition/appDependencies.ts
src/app/composition/createProductionDependencies.ts
src/components/conversation/ConversationPage.tsx
src/data/mockEntries.ts
src/lib/conversationPageData.ts
src/lib/conversationProfiles.ts
src/lib/useWebChat.ts（迁出）
src/workspaces/conversation/conversationWorkspaceState.ts
src/workspaces/conversation/conversationWorkspaceContract.ts
src/workspaces/conversation/index.ts
src/workspaces/conversation/useConversationWorkspace.ts
src/workspaces/conversation/webChatPort.ts
test/conversationWorkspace.test.ts
```

### 阶段 4 最终人工验收项

- Conversation Chat 激活时确认 WebChat SSE 建立，离开 Chat、进入列表、搜索或 Placeholder 时确认关闭。
- 返回 Chat 时确认使用已有 Cursor 恢复且不创建重复 EventSource。
- 发送普通消息，确认 submitting、sent、failed 与 unknown 展示和重试不变。
- 发送含附件消息，确认上传顺序、失败气泡和重试复用不变。
- 创建 Draft Thread 并发送，确认迁移到真实 Thread 后选择、Profile 与消息身份不变。
- 切换到 Timeline 或 Archive 后等待已提交发送完成，再返回确认事务结果未丢失。
- 确认 Live Record 被 Canonical 替换时气泡不重新挂载或重播动画。

### 阶段 5 执行结果

- 新增应用会话级 `createAppNavigation()`，发布只读 Navigation Snapshot。
- Navigation Intent 明确区分 Conversation、Timeline 与 Archive Target。
- 未知 Workspace 由 `UnknownWorkspaceError` 作为应用级错误拒绝。
- `App.tsx` 的当前 Workspace 激活状态改为消费 App Navigation Snapshot。
- App Navigation 新增按 Workspace 与 Revision 确认 Target 的窄操作；只有当前目标 Workspace 可以清除对应 Target，确认不会创建新的导航 Revision。
- Conversation Workspace 已自行校验 Thread、Date 与 Message Target，加载所需日期、更新自身页面状态，并将消息定位目标作为 View Model 交给 View。
- Conversation 通知和 Conversation 搜索跳转不再由 `App.tsx` 同时调用目标 Workspace 的多个 setter。
- 消息高亮的三秒视觉生命周期进入 Conversation View，Controller 不持有 Timer、DOM 或滚动能力。
- App Navigation 不校验 Thread、Date、Message、Event 或 Document，也不操作目标 Workspace Store、DOM、滚动或高亮。
- Timeline 与 Archive Target 已在阶段 6 由对应 Controller 接管；ADR-0003 现标记为 `Complete`。
- App Navigation 与 Conversation Navigation Characterization Tests 覆盖目标转交、未知 Workspace、确认清除、目标校验与过期 Revision 拒绝。
- `npm test`：110/110 通过。
- `npm run typecheck:strict`：通过。
- `npx tsc -p tsconfig.app.json --noEmit --incremental false`：通过。
- `npm run build`：通过。
- 生产构建仍有既有的 500 kB Chunk Size Warning，本阶段未处理。
- 本阶段未改变 JSX 生成结果、CSS、DOM 层级、滚动、窗口化或动画。
- 本阶段涉及的必要代码注释使用中文。
- 浏览器和真机完整交互验收继续延后到全部架构迁移完成后统一执行。

### 阶段 5 实际修改文件

```text
AGENTS.md
docs/adr/0003-workspaces-coordinate-through-navigation-intents.md
docs/architecture/migration-plan.md
src/App.tsx
src/app/navigation/appNavigation.ts
src/components/conversation/ConversationPage.tsx
src/workspaces/conversation/conversationWorkspaceState.ts
src/workspaces/conversation/index.ts
src/workspaces/conversation/useConversationWorkspace.ts
test/appNavigation.test.ts
test/conversationWorkspace.test.ts
```

### 阶段 5 最终人工验收项

- 使用 Bottom Navigation 在 Conversation、Timeline 与 Archive 间切换，确认激活结果不变。
- 从非 Conversation 页面点击消息通知，确认进入正确 Thread 和 Date。
- 点击 Conversation 搜索结果，确认线程、日期、消息定位和高亮不变。
- 点击 Timeline 搜索结果，确认日期、视图和 Event 高亮不变。
- 点击 Archive 或 Xiaoye 搜索结果，确认 Subject、Mode、日期和文档定位不变。
- 多次往返 Workspace，确认各 Workspace 领域状态不因 View 卸载丢失。

### 阶段 6 执行结果

- 新增持续挂载的 Timeline 与 Archive Workspace Controller，并继续复用现有 View Model builder。
- Timeline 的日期、视图、统计周期、Navigation Target、Mutation Sequence 与 Mutation Overlay 已归 Timeline Controller。
- Archive 的日期、Subject、Memory Mode、Xiaoye Mode、Navigation Target、Open Loops 乐观事务与 Mutation Overlay 已归 Archive Controller。
- 两个 Workspace 只读消费 ContentSync Snapshot；保存和删除不再由 `App.tsx` 直接修改 Timeline、Memory、Search Cache 或 Date Index Snapshot。
- 页面、领域搜索和日期可用性从 `Canonical Snapshot + Workspace Mutation Overlay` 的同一 Effective State 派生。
- Timeline 的 Fetch、Save、Delete 与 Archive 的 Load、Save、Toggle 通过窄 Port 注入 Controller；View 只调用 Workspace Commands，不再接收具体 Adapter。
- Timeline 与 Archive 自行校验并消费各自 Navigation Target，确认后通过 App Navigation 的 Workspace/Revision seam 清除 Target。
- 高亮的三秒计时器继续属于对应 View；Controller 不持有 DOM、滚动、Timer 或动画能力。
- 原来 Timeline 与 Archive 共用浏览日期的行为通过明确的 `BrowseDateFlow` 保持，不再依赖同一个 App `useState` 偶然耦合。
- 新 seam 继续复用现有页面构建逻辑，没有复制 Timeline、Diary、Memory、Letters 或 Xiaoye 规则。
- 新增 Workspace View Model、Mutation Overlay 与共享浏览日期 Application Flow Characterization Tests。
- `npm test`：113/113 通过。
- `npm run typecheck:strict`：通过。
- `npx tsc -p tsconfig.app.json --noEmit --incremental false`：通过。
- `npm run build`：通过。
- 生产构建仍有既有的 500 kB Chunk Size Warning，本阶段未处理。
- 本阶段未修改页面 JSX、CSS、DOM、滚动或动画。
- 浏览器和真机完整交互验收继续延后到全部架构迁移完成后统一执行。

### 阶段 6 实际修改文件

```text
AGENTS.md
docs/architecture/migration-plan.md
src/App.tsx
src/app/flows/browseDateFlow.ts
src/app/navigation/appNavigation.ts
src/components/archive/DirectoryPage.tsx
src/components/timeline/TimelineDayView.tsx
src/components/timeline/TimelineEventEditorDrawer.tsx
src/components/timeline/TimelinePage.tsx
src/components/timeline/TimelineReminderView.tsx
src/components/xiaoye/XiaoyePage.tsx
src/workspaces/archive/archiveMutationOverlay.ts
src/workspaces/archive/buildArchiveWorkspaceViewModel.ts
src/workspaces/archive/index.ts
src/workspaces/archive/useArchiveWorkspace.ts
src/workspaces/timeline/timelineMutationOverlay.ts
src/workspaces/timeline/buildTimelineWorkspaceViewModel.ts
src/workspaces/timeline/index.ts
src/workspaces/timeline/useTimelineWorkspace.ts
test/workspaceViewModels.test.ts
```

### 阶段 6 最终人工验收项

- 逐日与逐月切换 Timeline，确认 Event、统计、颜色和布局不变。
- 保存和删除 Timeline Event，确认页面、日期可用性、搜索与失败回退不变。
- 切换 Diary、Daily Summary、Letters、Facts、Preference、Open Loops、Project 与 Patterns，确认内容不变。
- 切换 Xiaoye 模式，确认内容、日期和交互不变。
- 保存 Memory、切换 Open Loops Checklist，确认草稿、回滚和错误位置不变。

### 阶段 7 执行结果

- `buildSearchResultState(...)` 新增明确的 Workspace Scope。
- Timeline 搜索只执行 Timeline 与 Reminder 搜索块。
- Archive 搜索只执行 Diary、Daily Summary、Letters、Static Memory 与 Xiaoye 搜索块。
- Conversation 的线程内与全局搜索继续只消费 Conversation Records。
- `DiarySearchBox` 的 JSX、CSS、动画、输入、高亮和结果点击反馈未修改，只接收当前 Workspace Scope。
- 新增 2 个搜索所有权测试；`npm test` 98/98、严格类型检查、应用类型检查与生产构建通过。
- 唯一有意行为变化是 Timeline 与 Archive 不再返回 Conversation 或彼此领域的结果。
- ADR-0004 标记为 `Implementation: Complete`。
- 补救复核确认 Reminder History 由 Timeline 的 `ReminderList` 展示，搜索点击语义也打开 Timeline 的既有 `reminders` 视图；Archive 没有该数据的页面或文档语义。
- 新增 Reminder 搜索所有权 Characterization Test，并修正 Timeline Controller 对既有复数视图名 `"reminders"` 的解释，防止点击结果无意回退到 Line View。
- 完整浏览器和真机验收仍在全部阶段结束后统一执行。

### 阶段 7 实际修改文件

```text
docs/adr/0004-search-is-owned-by-each-workspace.md
docs/architecture/migration-plan.md
src/App.tsx
src/components/search/DiarySearchBox.tsx
src/lib/searchPageData.ts
src/workspaces/timeline/useTimelineWorkspace.ts
src/workspaces/timeline/index.ts
test/searchOwnership.test.ts
```
