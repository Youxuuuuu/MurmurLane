---
Status: Accepted
Implementation: Partial
Date: 2026-07-27
ContentSync implementation: Complete
Workspace and View implementation: Partial
---

# ADR-0019：每种语义事实只有一个权威所有者

## Context

当前 `App.tsx` 分别保存：

- `remoteConversationsState`
- `remoteTimelineStateValue`
- Diary、Daily Summary、Letters
- Static Memory 与 Xiaoye Memory
- Reminder History
- `remoteDateIndexState`
- `remoteSearchCacheState`
- `remoteSearchMissingState`
- Conversation 未读计数
- 消息通知队列

随后通过 `useMemo` 将其中的远程数据组合成 `remoteData`。

`remoteData` 本身是派生聚合对象，不是独立权威状态。

当前还存在：

- Timeline 保存和删除后手工同步 Timeline State、Search Cache 和 Date Index。
- Conversation 页面读取 `remoteData.conversationEntries`，也会回退读取 `remoteData.searchCache.conversations`。
- 线程列表、日期加载范围和已加载判断会同时考虑当前 Conversation 数据与 Search Cache 中的数据。
- `searchPageData.ts` 使用以 `remoteData` 对象身份为 Key 的 `WeakMap` 缓存 Conversation 搜索文档。
- `ConversationPage.tsx` 通过 `useMemo` 推导 Merge、隐藏、分组、Render Identity 与消息索引。
- `ConversationPage.tsx` 同时保存窗口化、滚动锚点、动画 Ledger 与 Timer 等 View 状态。
- `useWebChat.ts` 保存 Live Records、Usage、Cursor、Draft Thread、发送事务和 Staged Send 等 Conversation 领域状态。

这些状态不能仅根据是否使用 `useState`、`useMemo`，或文件名中是否包含 `cache` 来分类。

迁移到 ContentSync 和 Workspace 后，如果同一语义事实被保存成多份状态，并由 Effect 或回调手工同步，将产生过期页面、搜索不一致、Mutation 漏更新和复杂 Effect 链。

## Decision

每一种语义事实和生命周期只有一个明确的权威所有者，不得维护多个需要 Effect 或回调手工同步的等价副本。

ContentSync 保存并发布来源数据 Snapshot。

Workspace 保存无法由当前 Snapshot 唯一推导的领域状态、Live State、Mutation Overlay 和用户意图状态。

View 保存其拥有的瞬时视觉与输入状态。

Transcript、View Model、有效领域模型、计数、排序和展示分组等能够由当前权威输入确定性计算的值，应作为派生值。

性能缓存可以保存派生计算结果，但必须可丢弃、可重建，并具有完整输入 Key 与明确失效规则，不得成为竞争性的业务事实来源。

### 语义事实，而不是实体唯一副本

本 ADR 不要求同一个领域实体在内存中只能出现一种表示。

例如一条 Conversation Message 可以同时存在：

```text
Canonical Record
Live Record
Send Transaction
Transcript Item
View Model Item
```

它们具有不同语义：

- Canonical Record 表示持久来源已经确认的事实。
- Live Record 表示实时来源中尚未被 Canonical 替换的事实。
- Send Transaction 表示用户发送意图的处理状态。
- Transcript Item 是 Canonical 与 Live 对账后的派生展示语义。
- View Model Item 是供当前 View 使用的派生数据。

禁止的是多个模块都维护等价的“最终消息列表”，并通过 Effect 手工保持同步。

### ContentSync 权威状态

ContentSync 拥有从同步来源读取的 Snapshot 与 Source Cache，例如：

- Canonical Conversation Records
- Timeline 来源数据
- Diary、Daily Summary、Letters 与其他 Memory
- Date Index
- Conversation Profiles
- Reminder History
- Content Source 的 Loading、Error、UpdatedAt、Connection 与 Revision
- 为搜索或历史浏览额外加载的 Keyed Source Data
- 已确认某个 Source Key 不存在的 Negative Source Cache 或同步元数据

Workspace 只读消费这些 Snapshot，不建立长期维护的镜像状态。

禁止：

```ts
useEffect(() => {
  setWorkspaceRecords(contentSnapshot.records);
}, [contentSnapshot.records]);
```

除非迁入的状态在 Workspace 中具有额外、明确且无法从 Snapshot 推导的领域含义。

### `remoteSearchCacheState` 的分类

当前 `remoteSearchCacheState` 是混合结构，不得整体视为派生性能缓存。

迁移时需要拆分：

```text
为搜索额外加载的 Conversation、Diary、Letters 等原始来源数据
→ ContentSync Keyed Source Cache

已确认缺失的日期或文档
→ ContentSync Negative Source Cache 或同步元数据

由来源数据构建的标准化文本、Search Document、Token 或索引
→ 对应 Workspace 的派生性能 Cache
```

不得因为名称中包含 `searchCache` 就直接删除，也不得继续把来源数据、搜索索引、当前 Query 和最终结果放在同一个无法区分所有权的对象中。

### Workspace 权威状态

Workspace 可以保存无法从当前 Snapshot 唯一计算的领域事实，例如：

- 当前线程、日期和业务页面模式
- Live Records
- WebChat Cursor
- Draft Thread
- 发送事务
- Staged Send 与上传事务关系
- Mutation Overlay
- Command 状态与 Mutation Sequence
- Last Seen Marker 或现有未读规则所需状态
- Navigation Target 的消费状态
- 需要跨 View 保留的领域草稿
- 当前领域选择和用户意图

这些状态不得被误删为 Snapshot 的重复副本。

### Mutation Overlay

Mutation Overlay 是 Workspace 权威状态，不是性能缓存。

读取路径为：

```text
ContentSync Canonical Snapshot
+
Workspace Mutation Overlay
→ Effective Domain State
→ Search / Date Availability / View Model
```

例如 Timeline 保存后：

```text
Canonical Timeline Snapshot
+
Confirmed Upsert Overlay
→ Effective Timeline Events
```

页面、Timeline 搜索和临时可用日期应从同一 Effective Domain State 推导，不再分别手工修补三份状态。

删除 Cache 或重新计算派生值不得清除 Mutation Overlay。

### Live Records

Conversation Live Records 继续由 Conversation Workspace 拥有。

正确关系为：

```text
Canonical Conversation Snapshot
+
Conversation Live Records
→ Conversation Transcript
```

Live Records 与 Canonical Records 的来源、确认阶段和生命周期不同，不属于同一事实的重复保存。

不得为了追求形式上的单一状态而删除 Live Records，或把 Live Records 直接写入 ContentSync Snapshot。

### Date Index

Date Index 是独立 Content Source Snapshot。

当前浏览器只加载部分 Conversation、Timeline 和 Memory 内容，因此：

```text
当前已加载内容
≠
完整可用日期索引
```

不得仅通过遍历当前加载数据替代 Server Date Index。

为了保持 Mutation 后的即时反馈，可以推导：

```text
Canonical Date Index
+
对应 Workspace Mutation Overlay 对日期可用性的影响
→ Effective Available Dates
```

新 Canonical Date Index 确认后，再清除对应 Overlay 影响。

### 派生值

能够由当前权威输入确定性计算的值默认不保存为独立同步状态，例如：

- Conversation Transcript
- Conversation Display Items
- Canonical 与 Live 的有效合并结果
- Effective Timeline Events
- Effective Archive Document
- Workspace View Model
- 当前 Thread Summary
- `canSend`
- Empty State
- 当前日期展示标签
- 搜索结果排序
- 搜索结果数量
- Timeline 当前可见 Event
- Transcript 与窗口范围对应的 Rendered Items

派生值不得通过以下方式手工同步：

```text
Snapshot 更新
→ Effect setDerivedState
```

派生函数应尽量纯净、确定，不执行请求、写缓存、触发导航或修改领域状态。

### 派生值的稳定身份

派生值可以被重新计算，但需要保持领域和渲染身份稳定。

Conversation Transcript 必须继续保证：

```text
相同逻辑消息
→ 相同稳定 Display / Render Identity
→ 相同 React Key
```

不得因为 Transcript 不保存为 State，就让每次计算产生新的不稳定身份，导致气泡重新挂载、动画重播或滚动锚点变化。

### View 权威状态

View 继续保存其独有的瞬时状态，例如：

- DOM Ref
- 滚动位置和锚点
- Transcript 窗口化范围
- 历史窗口扩展状态
- 动画 Ledger
- Touch 和手势状态
- 焦点
- 图片预览
- 菜单展开
- 浮动日期 Timer
- `requestAnimationFrame`
- 纯视觉 Loading

例如 `visibleWindow` 是 View 的窗口化状态，不应每次只根据消息数量重新推导。

正确关系为：

```text
Transcript
+
View visibleWindow
→ 当前 Rendered Transcript Items
```

其中 Rendered Items 是派生值，`visibleWindow` 是 View 状态。

### 输入草稿

输入草稿根据生命周期确定所有者：

```text
只在当前组件挂载期间存在
→ View

切换子页面或 Workspace 后仍需保留
→ Workspace

浏览器刷新后仍需保留
→ 另行设计持久化
```

本 ADR 不改变当前 Composer 草稿生命周期，不自动增加跨页面或跨刷新保存。

### 未读状态

当前源码保存并递增按 Thread 的未读计数，尚未证明存在足以完全重建当前行为的 Last Seen Marker。

因此第一轮必须先 Characterize：

- 新消息如何累加
- 查看线程何时清零
- 页面切换如何影响通知
- 初始加载为何不计为新消息
- 只加载部分历史时如何处理

不得现在直接宣布 Unread Count 一定是纯派生值。

目标设计可以区分：

```text
Last Seen Marker、已读边界或其他领域事实
→ Workspace 权威状态

由完整输入可可靠计算的 Unread Count
→ 派生值
```

在足够 Marker 与来源数据尚不存在时，可以暂时保留当前 Count 状态，直到单独迁移并验证。

### `useMemo`

允许使用：

```ts
useMemo(() => deriveValue(inputs), [inputs])
```

优化计算。

但 `useMemo`：

- 不改变值的所有权
- 不构成持久状态
- 不提供业务正确性保证
- 可以被 React 重新计算
- 不得用于记录事务
- 不得通过修改 Memo 结果表达 Mutation

正确性必须来自输入和派生函数，而不是依赖 Memo 必须命中。

### 性能缓存

派生性能缓存只有同时满足以下条件才成立：

- 删除缓存不会改变业务结果。
- Cache Hit 和 Cache Miss 产生相同语义输出。
- 缓存可以从权威输入重新构建。
- Cache Key 覆盖所有影响结果的真实输入。
- 缓存所有者明确。
- 失效规则明确。
- Snapshot 或算法语义变化后不会继续返回旧结果。
- 其他调用方不需要手工修改缓存才能保持正确。
- 缓存内部状态不作为业务事务、Mutation 或用户意图。

缓存实现可以使用 `Map`、`WeakMap` 或 Memo，但不得暴露为可被多个领域修补的共享业务 Store。

### Cache Key

Cache Key 根据真实计算输入设计，可能包含：

```text
Source Revision
Source Key
Workspace Search Scope
Thread Scope
Normalization Version
Display Extraction Version
其他真正影响输出的配置
```

不要求建立通用 Cache Key 框架。

仅使用一个聚合对象身份作为 Key 是否足够，应由 Characterization Tests 与真实输入关系验证。

### Keyed Source Cache 与派生 Cache

必须区分：

```text
conversation:{date}:{threadId} 的已加载 Canonical Records
→ ContentSync Keyed Source Cache
```

和：

```text
由这些 Records 构建的标准化 Search Documents
→ Workspace 派生性能 Cache
```

Keyed Source Cache 是 Workspace 可以消费的来源 Snapshot。

派生 Cache 只是优化手段，不得成为数据是否存在的权威判断。

### Search 状态

搜索拆分为：

```text
额外加载的来源数据
→ ContentSync Source Cache

当前 Query、筛选、Scope 和选中结果
→ 对应 Workspace 搜索状态

Search Document、Token、标准化文本
→ 对应 Workspace 可丢弃派生 Cache

最终 Result List、排序和计数
→ 派生值
```

ADR-0004 实施后，Conversation、Timeline 和 Archive 只拥有自己的搜索状态、语义和派生 Cache。

### Server Cache

Server Cache 与浏览器 ContentSync 分属不同边界：

```text
Server Cache
→ 减少文件读取、解析和索引成本

Browser ContentSync Source Cache
→ 保存浏览器已经获得的来源 Snapshot
```

浏览器不得依赖 Server Cache 是否命中，也不得通过浏览器 Revision 推断 Server Cache 状态。

Server Cache 由对应 Server 领域服务拥有，并在 ADR-0007 的 Server 分层中保持现有响应与失效语义。

### 不建立通用状态或缓存框架

当前不引入：

```text
GlobalStateRegistry
EntityStore
NormalizedAppStore
UniversalCache
GenericDerivedState
WorkspaceStateMirror
GenericSelectorFramework
```

也不因本 ADR 引入 Redux、Zustand 或其他全局状态框架。

目标是明确每项状态的语义和所有者，而不是把所有内容搬进同一个技术容器。

### 状态分类清单

每个 seam 迁移前，应将被迁移的现有 State、Ref、Memo 和 Cache 分类为：

```text
ContentSync Source Snapshot
ContentSync Keyed Source Cache
ContentSync Negative Cache / Sync Metadata
Workspace Domain State
Workspace Live State
Workspace Mutation Overlay
Workspace User Intent State
Derived Domain Value
Derived Performance Cache
View Transient State
View Input State
Server Cache
```

无法确认分类时，不得机械删除或迁移，应先补 Characterization Tests。

### Characterization Tests

实施前至少覆盖：

- `remoteData` 聚合前后结果一致。
- Snapshot 更新后 Transcript 与当前显示一致。
- Workspace 不需要 Effect 镜像 ContentSync Records。
- Live Records 与 Canonical Records 保持当前对账结果。
- Transcript 相同输入产生相同内容、顺序与稳定身份。
- View 的窗口化范围不会因移除派生 State 而重置。
- Timeline Mutation 后页面、Timeline 搜索和日期可用结果保持。
- Archive Mutation 的成功、失败、回滚和等待同步行为保持。
- 额外加载的搜索来源数据不会被误删为性能缓存。
- Search Cache 命中与重建产生相同结果。
- 删除派生性能缓存不改变结果。
- Source Revision 或语义输入变化后旧派生 Cache 不再使用。
- Conversation Keyed Source Cache 在切换日期后仍可复用。
- Date Index 不因只加载部分来源数据而丢失日期。
- 当前 Unread Count、清零和通知规则保持。
- View 卸载只清理它拥有的瞬时视觉状态。
- 当前 Composer 草稿生命周期不变。
- Server Cache 的响应与失效语义保持。

## Consequences

### Positive

- 等价语义事实不会形成需要手工同步的竞争副本。
- Canonical、Live、Transaction、Transcript 和 View Model 的不同语义得到保留。
- Source Cache、Negative Cache 和派生性能 Cache 可以按真实用途分别迁移。
- Mutation Overlay 可以统一驱动页面、搜索和日期可用性。
- View 窗口化、动画和输入生命周期不会因“去状态化”被误删。

### Negative

- 迁移前需要逐项分类现有 State、Ref、Memo 和 Cache。
- 当前混合型 `remoteSearchCacheState` 不能一次性搬迁或删除。
- Unread 等尚未证明可完全派生的状态需要先保留并补测试。

### Risks

- “单一事实来源”可能被误解为同一实体只能有一种内存表示。
- 派生值重新计算可能产生不稳定身份，影响 DOM、动画和滚动。
- 性能缓存可能通过不完整 Key 返回旧结果。
- Mutation Overlay 可能被错误当作可丢弃 Cache。

这些风险通过语义分类、稳定身份、完整 Cache Key、Characterization Tests 和一次迁移一个 seam 来控制。

## Implementation constraints

第一轮只分类状态，并在对应 seam 迁移时消除已经确认的镜像状态。

不得在本阶段：

- 机械删除所有 Cache
- 把 `remoteSearchCacheState` 整体当作性能 Cache
- 从部分加载数据重新构造完整 Date Index
- 提前把 Unread Count 改成 Marker 派生
- 删除 Conversation Live Records
- 将 Mutation Overlay 当作 Cache
- 把 `visibleWindow` 改成无状态计算
- 破坏 Stable Render Identity
- 建立全局 Store 或通用 Cache 框架
- 改变 UI、CSS、DOM、滚动或动画
- 修改源码、State、Cache、搜索、未读或 UI
