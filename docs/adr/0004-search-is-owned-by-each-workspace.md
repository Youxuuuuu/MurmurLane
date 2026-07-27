---
Status: Accepted
Implementation: Complete
---

# 搜索由各自 Workspace 拥有

当前只提供领域内搜索：Conversation 搜索只查询 Conversation Records，Timeline 搜索只查询 Timeline 数据，Archive / 回忆搜索只查询其拥有的 Diary、Memory、Letters 等内容。Workspace 不得直接读取另一个 Workspace 的索引、数据仓库或内部状态，Timeline 和回忆页的搜索也不包含 Conversation 对话内容。

现阶段不建立 App Search、Search Provider 接口或全局搜索聚合 store。只有出现明确的跨领域搜索需求时，才单独设计 App Search；届时各 Workspace 可以通过窄的 Search Provider 提供查询能力，App Search 聚合结果，并通过 App Navigation 打开目标。不得为了假设中的全局搜索提前建立抽象。

## Reminder 所有权复核

2026-07-27 根据当前源码确认 Reminder History 属于 Timeline 搜索范围：

- Timeline 的 `TimelineReminderView` 通过 `ReminderList` 消费 Reminder History。
- Reminder 的日期语义复用 Timeline 的日期与时区规则。
- Reminder 搜索结果使用 `mode: "Timeline"`，点击后打开现有 `timelineView: "reminders"`。
- Archive 页面和 Archive 搜索没有消费 Reminder History，也没有对应的文档身份或点击解释。

因此 ADR-0004 继续保持 `Implementation: Complete`。本次复核同时补充 Characterization Test，锁定 Reminder 只出现在 Timeline Scope，并修正 Controller 对既有 `"reminders"` 视图名的解释，避免架构迁移把搜索点击错误回退到 `"line"`。

这项决策只规定搜索语义与索引所有权，不规定搜索框的视觉实现。后续调整现有搜索数据流时，应保留已有页面 UI、样式、动画和交互表现。
