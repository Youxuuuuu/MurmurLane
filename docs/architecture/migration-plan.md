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
| 2 | Browser Config、Composition Root 与最小 Adapter | Pending | ADR-0009、0010、0015、0018 |
| 3 | ContentSync | Pending | ADR-0001、0002、0013、0017、0019 |
| 4 | Conversation Workspace Controller | Pending | ADR-0005、0006、0012、0014、0017 |
| 5 | App Navigation | Pending | ADR-0003、0010、0015 |
| 6 | Timeline 与 Archive Workspace | Pending | ADR-0005、0013、0014、0019 |
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
