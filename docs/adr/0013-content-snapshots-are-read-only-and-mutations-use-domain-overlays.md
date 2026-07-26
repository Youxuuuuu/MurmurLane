---
Status: Accepted
Implementation: Pending
---

# ContentSync Snapshot 只读，写操作使用领域 Mutation Overlay

ContentSync 发布的 Snapshot 对 Workspace 只读。领域写操作由 Workspace Command 发起；需要保持即时反馈时，Workspace 使用领域特定的 Mutation Overlay 推导 View Model，并通过 `invalidate(source)` 或 `refresh(source)` 请求 ContentSync 发布新 Snapshot。只有当新 Snapshot 在领域语义上确认对应变更后，才清除 Overlay。Workspace 不得直接修改 ContentSync 内部缓存，当前不建立通用 Optimistic Store、Entity Cache 或 Repository 框架。

## 当前源码事实

当前没有 ContentSync seam，`App.tsx` 同时持有 Canonical 数据、页面数据、搜索缓存和日期索引。Diary、Daily Summary 和 Letters 保存成功后，`handleMemoryEntrySaved` 直接更新对应 Entry State 和 `remoteDateIndexState`。Timeline 保存和删除成功后，分别手工更新 `remoteTimelineStateValue`、`remoteSearchCacheState.timeline` 和 `remoteDateIndexState`。

Open Loops Toggle 当前先修改本地状态，请求失败后恢复之前 Entry。文件 SSE 后续重新请求 Timeline、Memory 和日期索引，并再次覆盖相关状态。因此，本 ADR 消除 Workspace 对多份 ContentSync 缓存结构的手工同步，而不是取消保存后的即时页面反馈。

## Snapshot 只读

ContentSync 只向 Workspace 暴露只读 Snapshot 和同步元数据。Workspace 不获得 `setSnapshot()`、`setCache()`、`setRemoteTimelineState()`、`setRemoteSearchCache()`、`setRemoteDateIndex()` 或内部 React setter，也不了解 ContentSync 是否维护 Search Cache、Missing Cache、Date Index Cache、Request Map、SSE 队列或 Source Revision。

ContentSync Snapshot 表示从同步来源读取到的 Canonical 数据，不是供 Workspace 任意修改的共享 Store。

## Mutation Overlay

Mutation Overlay 是 Workspace 在 Canonical Snapshot 之上持有的领域变更。它可以是请求尚未成功的 Pending Overlay，也可以是 Server 已确认写入、但新 Canonical Snapshot 尚未确认结果的 Confirmed Overlay。本 ADR 不要求所有写操作都采用请求前乐观更新。

第一轮保持当前真实时机：Diary、Daily Summary、Letters 和 Timeline 编辑在 Adapter 成功返回后建立 Confirmed Overlay；Timeline 删除在 Server 成功后建立 Delete Tombstone Overlay；Open Loops Toggle 保留请求前乐观更新和失败回滚。不得把全部写操作统一改为请求前乐观更新。

Timeline 保存流程是：

```text
用户提交
→ Timeline Workspace Command 调用 Timeline Adapter
→ Adapter 返回 Server 保存后的 Event
→ Workspace 建立或更新 Confirmed Upsert Overlay
→ View Model 立即显示保存结果
→ Workspace 请求 ContentSync invalidate("timeline")
→ ContentSync 刷新并发布新 Snapshot
→ Workspace 在领域语义上确认 Snapshot 已包含保存结果
→ 清除该 Event 的 Overlay
```

Timeline 删除在 Server 确认后建立 Delete Tombstone Overlay，View Model 立即隐藏 Event；新 Snapshot 确认该 Event 已不存在后再清除 Tombstone。Diary 和其他 Memory 文档采用相同原则，并以 `documentType + documentId + date` 等真实领域身份确认。

## 页面、搜索与日期

根据 ADR-0004，搜索由对应 Workspace 拥有。Timeline Workspace 从 ContentSync Timeline Snapshot 与 Timeline Mutation Overlay 推导同一份 Effective Timeline Model，并由它产生 Timeline 页面、Timeline Search 和 Timeline 可用日期。Archive Workspace 同样从 Memory Snapshot 与 Memory Overlay 推导页面、领域搜索和可用日期。

迁移后不再要求写操作分别修改页面数据、搜索缓存和日期索引，但必须保持保存成功后页面立即更新、新内容立即进入领域搜索、新日期立即可用，以及删除当天最后一个 Timeline Event 后日期按当前规则移除等可观察行为。

## Overlay 确认与过期请求

任意新 revision 不足以清除 Overlay。Overlay 只有在对应领域结果得到确认后才能清除：

- Timeline Upsert：相同 `event.id` 已存在，且保存涉及的关键字段与 Adapter 成功结果一致。
- Timeline Delete：对应 `event.id` 已不存在。
- Memory Document：相同文档身份与日期已反映保存后的内容或服务端版本。
- Open Loops：Canonical Entry 已反映目标 Checklist 状态。

无关来源、日期刷新或单纯 revision 增加不构成确认。若当前契约缺少稳定版本字段，第一轮比较经过现有归一化后的领域内容，不虚构尚未提供的版本契约。

ContentSync 为每个真实 Source 维护 Request Generation 或 Invalidation Epoch。旧 generation 启动的请求即使最后返回，也不能覆盖新 generation 已发布的 Snapshot。Source 粒度至少区分 Conversation、Timeline、各类 Memory、Date Index 和其他当前真实 Content Source，具体依据现有刷新行为确定，不建立通用缓存框架。

同一领域实体的连续写入使用 Workspace 内的 Mutation Sequence 或等价机制，较旧请求结果不得覆盖较新的用户操作；不为此建立全局事务框架。

## 失败语义

Adapter 写入失败时，当前非乐观操作不建立 Confirmed Overlay，Workspace 保持原 View Model，Command 返回明确错误，View 按当前行为显示失败。已有乐观操作失败时恢复前一个领域结果，不把失败状态写入 ContentSync Snapshot。

写入成功但刷新失败时，保留 Server 已确认的 Overlay，页面继续显示成功结果，并标记为等待 Canonical 同步；后续通过 SSE、重连或显式 retry 再确认。不得因刷新失败将已经成功写入的数据回滚为旧 Snapshot。

## 与 Conversation 的关系

Conversation 继续使用：

```text
Canonical Records
+
Live Records
→ Conversation Transcript
```

Live Records 是 Conversation Workspace 的领域 Overlay，不写入 ContentSync Snapshot。Timeline 和 Memory 复用相同所有权原则，但不复制 Conversation Identity 算法，也不建立通用跨领域 Overlay Store。每个 Workspace 按自己的领域身份、保存结果和确认规则实现最小 Overlay。

## Characterization 与实施限制

实施前刻画 Diary 保存成功与失败、日期可用状态、Timeline 页面与搜索即时更新、新增与删除日期、Open Loops 乐观回滚、写成功但刷新失败、旧刷新保护、无关 revision、Canonical 确认清除、连续写入最后一次生效，以及 SSE 不重复、不复活删除内容、不丢失保存内容。

第一轮只建立只读 Snapshot、领域 Mutation Overlay 和 invalidate / refresh seam。必须保持编辑器 UI、保存按钮与 Loading、错误提示、Timeline 与 Archive 页面、领域搜索、日期结果、SSE、动画、交互以及各操作当前的更新时机。不得引入通用 Optimistic Store、Entity Cache、Repository、跨 Workspace Mutation Store、新 Server 版本协议或新的 UI 保存状态设计。
