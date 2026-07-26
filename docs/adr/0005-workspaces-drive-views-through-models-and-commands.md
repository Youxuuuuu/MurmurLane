---
Status: Accepted
Implementation: Pending
---

# Workspace 通过 View Model 和 Commands 驱动 View

Workspace 通过 View Model + Commands 驱动页面。领域状态与业务流程归 Workspace Controller；DOM、滚动、手势和动画等瞬时展示状态归 View，双方不得越过 seam 操作彼此的内部实现。Controller 消费 ContentSync Snapshot 和技术 Adapter，拥有当前线程、日期、Profile、业务页面模式、Live / Canonical Records 对账、未读、删除后选择、发送与重试、navigation target 解释、请求状态和领域错误，并推导 View Model、提供 Commands。

View Model 只暴露页面渲染所需的派生数据，例如当前线程、可见线程、Transcript、发送能力、发送状态、空状态和 navigation target。它不是第二份独立状态，不暴露 ContentSync 缓存内部结构、React setter、API 请求对象、EventSource、对账细节或 Controller 内部 Store。Commands 表达 `selectThread`、`openDate`、`sendMessage`、`retryMessage`、`deleteThread` 等用户意图，不得只是内部 setter 的改名；View 不直接修改 Controller 状态或调用底层 API。

View 拥有 JSX、视觉组件、DOM refs、滚动、锚点、窗口化、触摸与左滑手势、Framer Motion、动画 ledger、输入焦点、浮动日期计时器、图片预览和局部展开状态，并根据 View Model 中的目标执行定位、高亮和视觉反馈。View 不请求领域数据、不修改 ContentSync 缓存、不执行 Live / Canonical 对账，也不决定删除后的线程选择；Controller 不查询 DOM、不持有滚动容器 ref、不调用 `scrollTo` 或控制动画帧，但可以表达定位等展示意图。

Controller 不要求使用 Class、Redux、Zustand 或新的全局 Store。实施时优先形成一个有深度的 Workspace Controller，避免拆成大量相互传参的浅 Hook；第一轮只迁移业务状态、View Model 与 Commands，保留现有 JSX、CSS、DOM 结构、动画、滚动时序和交互表现。View Model 只做派生，不复制 Controller 状态；新增模块默认使用严格类型。
