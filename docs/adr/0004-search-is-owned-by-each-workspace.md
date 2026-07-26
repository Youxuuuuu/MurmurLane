---
Status: Accepted
Implementation: Pending
---

# 搜索由各自 Workspace 拥有

当前只提供领域内搜索：Conversation 搜索只查询 Conversation Records，Timeline 搜索只查询 Timeline 数据，Archive / 回忆搜索只查询其拥有的 Diary、Memory、Letters 等内容。Workspace 不得直接读取另一个 Workspace 的索引、数据仓库或内部状态，Timeline 和回忆页的搜索也不包含 Conversation 对话内容。

现阶段不建立 App Search、Search Provider 接口或全局搜索聚合 store。只有出现明确的跨领域搜索需求时，才单独设计 App Search；届时各 Workspace 可以通过窄的 Search Provider 提供查询能力，App Search 聚合结果，并通过 App Navigation 打开目标。不得为了假设中的全局搜索提前建立抽象。

这项决策只规定搜索语义与索引所有权，不规定搜索框的视觉实现。后续调整现有搜索数据流时，应保留已有页面 UI、样式、动画和交互表现。
