---
Status: Accepted
Implementation: Complete
---

# Workspace Controller 在应用会话内持续存在

ContentSync、App Navigation 和 Workspace Controller 具有应用会话级生命周期，由 AppRoot 持续持有；View 按照当前页面结构挂载和卸载。Controller 的领域状态不得因 View 卸载而意外丢失，但 HTTP、SSE 等技术资源可以根据 Workspace 和页面模式的活动状态创建和释放。任何领域状态重置必须通过明确 Command，不能依赖组件碰巧卸载。

## 当前源码事实

当前大部分 Conversation、Timeline、Archive 和远程数据状态由持续挂载的 `App.tsx` 持有。`selectedThreadId`、Conversation 日期、Web Thread、Profile overrides、远程缓存、未读和通知队列不会因切换 Workspace 自动销毁。

`useWebChat()` 在 `App.tsx` 中无条件调用，是否启用由 `activeSection === "Conversation" && conversationView === "chat" && !conversationPlaceholder` 控制。禁用时，当前 Hook effect 将连接状态设为 `idle` 并清理订阅，但不会清空 Live Records、Usage、Cursor、发送事务和其他 Hook 状态。

Conversation、Timeline 和 Archive View 通过条件渲染切换，Conversation 内部列表、全局搜索、线程搜索和聊天 View 也会互相挂载与卸载。`ConversationPage` 拥有滚动、锚点、窗口化、Touch、DOM refs、动画 Ledger 和浮动日期计时器等 View 局部状态。因此，本 ADR 保持当前“领域状态常驻、技术资源按活动状态启停、View 可以卸载”的行为。

## 生命周期层级

```text
AppRoot 生命周期
├─ ContentSync
├─ App Navigation
├─ Conversation Controller
├─ Timeline Controller
├─ Archive Controller
└─ 其他已建立的 Workspace Controller

View 生命周期
├─ 当前激活页面
├─ 当前 Conversation 子页面
└─ DOM、滚动、动画和手势状态
```

Workspace Controller 由持续挂载的 React 组合层创建，不得只在当前 Workspace View 的条件分支内创建。若 Controller 采用 React Hook，该 Hook 在稳定的根组合组件中无条件调用，并通过活动状态控制副作用。

## Controller 与 View 状态

Conversation Controller 持有当前线程、Conversation 日期、Web 与 Draft Thread、Profile 领域状态、Live Records、Usage、发送事务、SSE Cursor、未读与通知规则所需状态、Live / Canonical 对账输入、页面业务模式、领域错误和请求状态。这些状态不因聊天、列表、搜索或其他 Workspace View 卸载而清空。

Timeline 和 Archive 当前由 `App.tsx` 持有的业务选择与加载状态，在迁移到对应 Controller 后保持现有生命周期。

DOM refs、滚动位置与锚点、Transcript 窗口、左滑与触摸、Framer Motion 与动画 Ledger、浮动日期计时器、图片预览、菜单展开、输入焦点和纯视觉临时状态继续属于 View，并按照当前行为随 View 卸载。本 ADR 不引入跨 Workspace 滚动保存，也不要求所有 View DOM 常驻；未来若要求返回 Conversation 时恢复完全相同滚动位置，应作为产品行为变化单独决策。

## 活动状态与资源

Controller 常驻不等于 EventSource、HTTP 请求和后台任务常驻。Adapter 只根据 Controller 指令创建和释放技术资源。

当前 WebChat 活动策略保持不变：Conversation Chat View 激活时允许订阅；离开 Conversation、进入列表、进入搜索或显示 Placeholder 时暂停订阅；暂停不清空 Live Records、Usage、Cursor 或发送事务；返回 Chat View 时使用保留状态和 Cursor 恢复连接，不创建重复 EventSource 或重复消费事件。

活动输入不能被过度简化。实施时保留 `activeSection`、`conversationView` 和 Placeholder 对资源策略的真实影响，可以通过明确 Activity Model 或派生状态表达。

Controller 在 View 未激活时仍能完成已经开始的领域操作，包括已提交 WebChat 请求的成功、失败或未知结果、Draft Thread 迁移、ContentSync 新 Canonical Snapshot 接收、已有未读和通知规则以及领域错误更新。View 未挂载不能导致结果丢失；是否允许后台发起新业务操作不由本 ADR 扩大。

## 状态重置与 Composition Root

领域状态只能通过 `resetWorkspace()`、`switchAccount()`、`endApplicationSession()` 等明确事件或 Command 重置。切换 Bottom Navigation、View 卸载、关闭搜索或切换 Timeline、Archive 不构成领域重置。浏览器刷新、关闭页面或 AppRoot 卸载结束当前应用会话；本 ADR 不引入 localStorage、IndexedDB、跨浏览器会话恢复或跨设备同步。

App Composition Root 创建并注入 Adapter，持续挂载的 AppRoot 创建 Workspace Controller，并向其传入 Adapter、ContentSync Snapshot、App Navigation 和 Workspace 活动状态。View 只接收 View Model 与 Commands。

## Characterization 与实施限制

实施前刻画 Workspace 往返切换后的线程、日期和页面状态，Live Records、Usage、Web Thread、Profile、未读与通知的保留，EventSource 关闭与 Cursor 恢复，各 Conversation 子页面连接策略，重复订阅防护，切页后发送结算、Draft Thread 迁移、未激活时 Snapshot 消费，以及只有明确 Reset Command 或会话结束才清理领域状态。

第一轮只迁移 Controller 的挂载层级和生命周期所有权。必须保持 JSX、CSS、DOM、Conversation View 条件渲染、WebChat 启用条件、EventSource 时机、Cursor、Live Records、Usage、Draft Thread 迁移、未读、通知、滚动、窗口化和动画行为。不得强制所有页面 DOM 常驻，也不得增加后台常连接、跨刷新持久化、滚动恢复或新的缓存淘汰策略。

## Implementation status

2026-07-27 已完成：

- Conversation、Timeline 与 Archive Controller 都由持续挂载的 AppRoot 组合层无条件创建。
- Workspace View 条件卸载不再销毁线程、日期、页面模式、Live State、Mutation Overlay 或 Command 事务。
- WebChat EventSource 继续只按 Conversation Chat 的现有 Activity 条件启停；暂停不清空领域状态。
- DOM、滚动、窗口化、焦点、手势与高亮 Timer 继续由对应 View 持有。
