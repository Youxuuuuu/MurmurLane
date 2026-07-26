---
Status: Accepted
Implementation: Pending
Date: 2026-07-27
---

# ADR-0017：异步结果由其状态所有者决定是否提交

## Context

当前源码已经存在多种不同的并发机制：

- `App.tsx` 使用 `pendingLiveEventsRef` 按事件类型、日期、模式和线程合并文件变化事件。
- 文件变化事件通过短延迟批处理；页面隐藏时关闭订阅，重新显示时触发 `resync`。
- 文件刷新任务会并行读取 Conversation、Timeline、Memory 和其他数据，并在返回后分别提交状态。
- 当前文件刷新已有事件合并与去重，但没有正式 ContentSync Source Generation seam。
- 搜索实现已使用取消或局部有效性标记，防止被替代的查询继续更新当前结果。
- `chatApi.ts` 使用 `AbortSignal` 或 `AbortController` 实现技术超时。
- `useWebChat.ts` 为每个线程维护 SSE Cursor。
- `useWebChat.ts` 使用稳定 `requestId`、发送事务、Message 映射和 Draft Thread 状态。
- WebChat 已存在 `submitting`、`sent`、`failed` 和 `unknown` 等事务语义。
- 模糊发送错误会查询服务端状态，而不是直接重新发送。
- 已进入成功终态的发送不会被迟到的失败结果退回旧状态。
- `useWebChat` 在持续挂载的 `App.tsx` 中运行，因此当前已提交事务不依赖 Conversation View 存活。

这些是已经存在但分散在 `App.tsx`、`useWebChat.ts`、Adapter 和纯逻辑模块中的真实规则。

本 ADR 将这些规则归还给正确的状态所有者，而不是建立一套全新、通用的异步框架。

## Decision

每个状态所有者负责其异步操作的并发与结果提交语义。

ContentSync 负责读取、刷新和文件事件同步的 Source/Key Generation、Snapshot Revision、事件去重与过期结果丢弃。

Workspace 负责领域 Command 的操作身份、事务状态、Mutation Sequence、幂等要求和结果提交。

Adapter 只提供请求、取消、超时和订阅等技术能力，不决定较晚结果是否仍具有领域效力。

不得以组件卸载、单个全局 `isLoading` 或通用“最后请求获胜”规则代替明确的领域并发语义。

### 状态所有者原则

结果能否提交，由被修改状态的所有者决定：

```text
ContentSync Snapshot
→ ContentSync 决定读取结果是否仍有效

Workspace 领域状态与 Mutation Overlay
→ 对应 Workspace 决定 Command 结果是否仍有效

View 局部状态
→ View 决定滚动、动画、焦点等视觉异步结果是否仍有效
```

Adapter 不拥有上层状态，因此不决定某个返回结果是否应更新 Snapshot、Overlay 或 View Model。

### 读取操作

读取使用按 Source 和请求 Key 管理的 Generation。

不得建立一个全应用共享 Generation，使无关 Source 互相作废。

请求 Key 应依据真实读取身份确定，例如：

```text
conversation:{date}:{threadId}
timeline:{month-or-date}
memory:{documentType}:{documentId}:{date}
date-index
conversation-profiles
```

这些只是表达当前读取身份的示例。具体 Key 由真实数据读取语义决定，不提前建立通用 Key 框架。

每次新读取遵循：

```text
获取对应 Source/Key 的 Generation
→ 发起请求
→ 返回时重新检查 Generation
→ 仍有效才允许提交
```

`AbortController` 可以用于节省资源，但不是正确性的唯一保证。无法物理取消的旧请求，也必须在提交时被逻辑拒绝。

不同 Source 和不同 Key 可以独立并行。

Timeline 请求不得使 Conversation 请求失效；日期 B 的请求也不得无理由使日期 A 的独立缓存请求失效。

### 当前选择与 Keyed Cache

对于当前选择型结果：

```text
选择日期 A
→ 再选择日期 B
→ A 后返回
```

A 不得重新覆盖当前 B 页面。

但如果 A 仍是 `conversation:A` 这一 Key 的当前有效 Generation，它可以被保存进 A 的 Keyed Cache，供未来返回 A 时使用。

因此，“最新意图有效”应按结果所属的 Source、Key 和目标状态判断，不使用粗暴的全局最后请求获胜。

### Snapshot Revision 与 Request Generation

二者不得混为一谈：

```text
Request Generation
→ 判断某个异步读取结果是否仍可提交

Snapshot Revision
→ 标识 ContentSync 已经发布的快照版本
```

仅增加 Snapshot Revision 不能阻止旧请求迟到覆盖。

ContentSync 必须在提交结果前检查对应 Source/Key Generation 或等价的 Invalidation Epoch。

当前不要求 Server 提供远端 Revision。第一轮可以使用 ContentSync 本地 Generation 和发布 Revision。

### 搜索

搜索并发由对应 Workspace 拥有：

```text
Conversation Workspace
→ Conversation Query Generation

Timeline Workspace
→ Timeline Query Generation

Archive Workspace
→ Archive Query Generation
```

旧 Query 的结果不得覆盖当前 Query。

被替代、取消或过期的搜索请求默认不产生用户错误。

如果未来建立 App Search，它拥有自己的 Query Generation，但不得通过该机制读取或修改各 Workspace 内部 Store。

### Mutation 与领域 Command

写操作不得默认套用“最后请求获胜”。

每个 Workspace 应根据真实领域定义操作身份和提交规则，例如：

```text
targetId
localMutationSequence
commandId
startedAtSnapshotRevision
```

这些字段只是可选设计元素，不要求所有 Workspace 使用统一结构。

Workspace 负责判断：

- 两个操作是否针对同一目标
- 是否允许并行
- 较旧结果是否仍有效
- 是否更新或保留 Mutation Overlay
- 是否回滚
- 是否进入冲突或等待同步
- 是否允许重试
- View 卸载后是否继续结算

不得使用单个 Workspace 全局 `isLoading` 表示多个独立 Mutation。

View 可以继续拥有当前 `isSaving`、`isDeleting` 等局部显示状态，但它们不得成为领域并发正确性的唯一来源。

### 本地操作身份与服务端幂等

必须区分：

```text
Workspace 本地 Mutation Sequence
```

和：

```text
服务端正式支持的幂等 Key 或 Revision
```

WebChat 的 `requestId` 是当前真实存在的跨网络事务身份，必须继续保留。

当前不得假设 Timeline 或 Memory API 已经支持：

```text
commandId
expectedRevision
idempotencyKey
```

在服务端契约不存在时，Workspace 可以使用本地 Mutation Sequence 防止旧结果覆盖较新操作，但不能声称已经获得服务端幂等保证。

任何新增服务端幂等、版本或冲突协议都应作为独立契约变化处理。

### 连续 Mutation

同一目标连续发生多次写入时，较旧结果不得覆盖新的用户意图。

例如：

```text
Timeline Event Save A 开始
→ Save B 开始
→ B 先成功
→ A 后成功
```

Workspace 应根据目标身份和 Mutation Sequence 判断 A 是否还能影响 Overlay 或 View Model。

具体采用串行、丢弃旧结果、提示冲突还是重新同步，由 Timeline 领域规则决定，不建立通用 Mutation Queue。

### WebChat 发送

WebChat 继续保留当前事务流程：

```text
用户发送
→ 建立稳定 requestId 和 messageId
→ 准备附件
→ 建立发送事务
→ submitting
→ 明确成功：sent
→ 明确失败：failed
→ Timeout 或网络模糊：查询发送状态
→ 仍无法确认：unknown
```

必须保持：

- 模糊错误不直接产生第二条新发送。
- 状态查询确认 accepted 后进入成功。
- 显式重试继续遵守当前 `requestId` 语义。
- 已进入 accepted 或 sent 的事务不能被迟到失败退回。
- 较旧失败不能覆盖较新事务状态。
- HTTP 返回和 WebChat SSE 按同一事务身份对账。
- Draft Thread 到真实 Thread 的迁移不能被重复执行。
- View 卸载不得清除已提交事务、Draft Thread 迁移或结算结果。

这些规则属于 Conversation Workspace，不属于 WebChat Adapter 或 Conversation View。

### 上传

附件上传可能同时涉及：

```text
本地 Upload 身份
发送 requestId
messageId
Draft Thread
最终 Conversation Record
```

第一轮继续保留当前上传、暂存发送和正式发送顺序。

不得因上传超时自动重新创建一条新发送事务。

是否重试单个上传、复用已成功上传结果或重试整个发送，由 Conversation Workspace 根据现有事务状态决定。

### SSE 与事件流

事件流不使用普通读取的通用最后请求获胜规则。

#### WebChat SSE

WebChat 当前协议提供 Cursor，因此：

- Conversation Workspace 按线程维护 Cursor。
- 重连使用已有 Cursor。
- 较小或重复 Cursor 不得倒退状态。
- Event Identity 和 Conversation Identity 共同用于去重与对账。
- Adapter 只创建和关闭 EventSource，并传递事件与连接状态。

#### 文件 SSE

文件 SSE 属于 ContentSync。

当前文件 SSE 主要依赖：

- 事件 Key 去重
- 短延迟合并
- 页面可见性管理
- 重连后的完整 `resync`
- Canonical 数据重新读取

当前没有验证文件 SSE 已提供稳定服务端 Cursor，因此本 ADR 不要求为它虚构 Cursor。

规则为：

```text
协议真实提供 Cursor
→ 使用 Cursor

协议没有 Cursor
→ 使用事件身份、去重、批处理和 Resync
```

新增文件 SSE Cursor 属于 Server 契约变化，应单独设计。

### 重复订阅

每个外部订阅必须有明确身份，例如：

```text
file-sse
webchat:{threadId}:{clientId}
```

状态所有者负责保证同一有效订阅不会重复建立。

Adapter 返回明确的 Unsubscribe，但不决定何时切换订阅目标。

必须验证：

- 多次 Workspace 切换不产生重复 EventSource。
- React 开发模式重复执行 Effect 时，不产生持久重复订阅。
- 旧订阅的迟到事件不能污染新订阅目标。
- 停止订阅后保留的领域状态符合 ADR-0012。

### 生命周期与取消

组件卸载不是领域并发规则。

可以随 View 卸载取消的通常包括：

- 当前搜索建议
- DOM 测量
- 滚动动画
- 图片预览加载
- 纯视觉定时器

不得因 View 卸载丢失：

- 已提交 WebChat 发送
- 已开始并纳入发送事务的附件处理
- 已提交 Timeline 或 Memory Command
- 已成功写入但等待 Canonical 确认的 Overlay
- Draft Thread 迁移
- 应用级 ContentSync 同步

主动取消、旧 Generation 丢弃和被替代的搜索默认不产生错误 UI。

### Adapter 边界

Adapter 可以负责：

- HTTP 请求
- Abort
- Timeout
- EventSource 创建与关闭
- 技术错误归一化
- 传递远端 Cursor、Revision 或响应身份

Adapter 不负责：

- 选择当前 Generation
- 判断 Mutation 结果是否过期
- 决定 Overlay 提交或回滚
- 决定发送是否 unknown
- 判断迟到结果是否仍有领域效力
- 管理 Workspace 事务状态

### View 边界

View 可以拥有纯展示异步状态，例如：

- `requestAnimationFrame`
- 滚动补偿
- 动画 Timer
- 图片加载状态
- 焦点恢复

View 不得根据返回顺序直接修改 Workspace 领域状态，也不得以组件卸载取消已提交领域 Command。

View 只通过 View Model 观察状态，通过 Commands 发出用户意图。

### 不建立通用异步框架

当前不引入：

```text
GlobalAsyncManager
UniversalRequestStore
GenericCommandQueue
GlobalPendingOperations
GenericAsyncState<T>
AppEventBus
```

可以复用领域中立的小型机制，例如 Abort 辅助或测试 Fake Clock，但结果是否有效仍由对应状态所有者判断。

不得把 Read、Search、Mutation、Upload 和 SSE 压缩成相同的：

```ts
{
  data,
  loading,
  error,
}
```

模型并据此丢弃真实事务语义。

### Characterization Tests

实施前至少覆盖：

- 同一 Source/Key 的旧请求晚返回不会覆盖新结果。
- 不同 Source 和不同 Key 可以独立并行。
- 日期 A 的迟到结果不会覆盖当前日期 B。
- 仍然有效的日期 A 结果可以进入 A 的 Keyed Cache。
- 旧 Query 不会覆盖当前搜索结果。
- 被替代搜索和旧 Generation 丢弃不产生错误 UI。
- 文件 SSE 重复事件只触发一次有效刷新。
- 文件 SSE 批处理和页面恢复 `resync` 行为保持。
- 无 Cursor 的文件 SSE 不被强行改成虚构 Cursor 协议。
- WebChat 重连使用当前线程 Cursor。
- 重复或较旧 Cursor 不倒退状态。
- 页面多次切换不会建立重复 EventSource。
- WebChat Timeout 继续查询发送状态。
- 状态查询确认 accepted 后进入 sent。
- accepted 不会被迟到 failed 覆盖。
- unknown 重试继续遵守现有 `requestId` 语义。
- Draft Thread 不会被并发创建或迁移两次。
- 上传成功结果不会因后续重试无意重复上传。
- View 卸载不丢失已提交领域操作。
- 同一 Timeline Event 的较旧保存结果不会覆盖较新操作。
- Timeline、Memory 和 Open Loops 当前成功、失败、回滚与刷新行为保持。

## Consequences

### Positive

- 不同类型的异步操作保留其真实语义。
- 旧读取结果、迟到事件和重复订阅更容易被明确阻止。
- WebChat 已有事务身份、Cursor 和未知结果语义不会在迁移中丢失。
- View 生命周期不再隐式决定领域操作是否有效。
- 本地并发保护不会被错误描述为服务端幂等保证。

### Negative

- ContentSync 和 Workspace 需要维护少量明确的 Generation、Sequence、Cursor 或事务状态。
- 测试需要覆盖不同返回顺序，而不只是成功路径。
- 不同领域可能采用不同并发策略，不能依靠一个通用抽象统一理解。

### Risks

- Generation 粒度过粗会使无关请求互相作废。
- Generation 粒度过细会使提交判断难以维护。
- 将本地 Mutation Sequence 误当成服务端幂等，可能掩盖重复写入风险。
- React Effect Cleanup 可能被误用为领域事务取消。

这些风险通过 Source/Key 所有权、明确事务身份、Characterization Tests 和不虚构服务端契约来控制。

## Implementation constraints

第一轮只在迁移对应 seam 时显式保留和归属现有并发规则。

不得在本阶段：

- 建立全局异步管理器
- 为所有请求统一套用最后请求获胜
- 给所有 Source 使用一个 Generation
- 给文件 SSE 虚构 Cursor
- 给 Timeline 或 Memory 虚构服务端幂等协议
- 改变 WebChat `requestId` 和重试语义
- 改变上传、发送和 Draft Thread 的执行顺序
- 改变现有错误 UI
- 改变 View 的滚动、动画或生命周期行为
- 修改源码、网络协议、事务状态或 UI
