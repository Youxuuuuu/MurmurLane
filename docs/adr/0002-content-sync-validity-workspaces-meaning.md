---
Status: Accepted
Implementation: Partial
---

# ContentSync 管理有效性，Workspace 解释意义

ContentSync 管理来源数据何时有效，Workspace 决定数据意味着什么以及页面如何响应。ContentSync 负责启动加载、文件 SSE 与连接生命周期、失效范围判断、刷新、重试、重新同步、缓存、数据版本，并发布来源数据快照及 `loading`、`error`、`updatedAt`、`connectionStatus`、`revision` 等同步元数据；它可以提供 `refresh(source)`、`retry(source)` 和 `invalidate(source)` 等窄的技术操作。

ContentSync 不拥有当前页面、线程或日期，不执行 Live / Canonical 对账、未读与通知规则、搜索筛选和排序语义、页面 View Model、滚动与动画、删除后的选中项和跳转，也不协调 Workspace 之间的业务流程。Workspace 消费 ContentSync 的快照并按自身领域规则解释数据；例如 Conversation 文件变化由 ContentSync 刷新 Canonical Records，而 Live Records 对账、未读计算和页面响应仍由 Conversation Workspace 决定。

这条 seam 使同步实现可以从本地文件 SSE 替换为云端 API、WebSocket 或其他机制，而无需重写 Workspace 的业务规则，同时避免 ContentSync 演变为全局业务控制器。
