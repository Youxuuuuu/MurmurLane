---
Status: Accepted
Implementation: Partial
---

# Conversation Transcript 是唯一展示语义入口

Conversation Workspace 拥有唯一的 Transcript 构建 seam：

```ts
buildConversationTranscript({
  canonicalRecords,
  liveRecords,
  threadId,
}): ConversationTranscript
```

这是 Conversation Records 到可渲染展示语义的唯一公共入口。唯一入口不意味着巨型文件；实现应复用现有 `conversationMerge`、`conversationIdentity`、`conversationDisplayGroups`、`conversationMediaDisplay` 和 `assistantTurnModel`，第一轮不迁移这些文件，也不复制其逻辑。

Transcript 负责 Canonical 与 Live Records 对账、去重、Canonical 替换 Live、稳定 Display Identity、确定性排序、隐藏规则、图片、文件、Sticker 与 Operation 展示分组、Assistant Turn 组织，并输出可直接供页面消费的展示条目。同样输入必须产生同样输出；Transcript 不依赖 API、ContentSync、DOM、React refs、滚动状态、动画 ledger 或当前视口。

Transcript Entry 必须继续复用现有 Conversation Identity 规则。当同一条 Live Record 被 Canonical Record 替换时，应保持稳定 React Key、气泡 DOM 连续性、动画资格、滚动锚点以及 Operation 和媒体顺序，避免无意义的身份变化和入场动画重播。Transcript 是 Controller 当前状态的派生值，不保存为需要手动同步的第二份状态；View Model 可以包含该结果，但不得复制并长期维护另一套 Transcript 数据。

第一轮复用已有 `ConversationDisplayItem` 和 Assistant Turn 模型，`ConversationTranscript` 仅作为现有展示条目的容器或明确返回结构，不另造含义重叠的 Entry 联合类型。Audio、Call、Usage 等类型只有在 Cyberboss 契约明确后才能加入。

View 负责 Transcript 窗口化、DOM refs、滚动与锚点、日期分隔和浮动日期、搜索定位与视觉高亮、Framer Motion、气泡动画资格与 ledger、触摸、左滑、局部展开状态，以及 `ChatBubble` 和 `AssistantTurn` 渲染。View 不再自行组合 merge、hide、group、identity 和 Assistant Turn 规则；Workspace Controller 不查询 DOM、不持有滚动 ref、不调用 `scrollTo`，也不控制动画帧。

实施前先为 Transcript seam 补充 Characterization Tests，再按现有顺序收敛调用链。第一轮必须保持 `ChatBubble`、`AssistantTurn`、JSX、CSS、DOM 层级、React Key、动画身份、滚动、窗口化、动画时序以及实时与归档显示结果不变。

## Implementation status

2026-07-27 已完成：

- 建立 `buildConversationTranscript(...)` 公共 seam。
- 建立 Transcript 窗口选择接口，由 View 提供窗口、Transcript 组织完整 Assistant Turn。
- 将 `ConversationPage.tsx` 的 Merge、隐藏、展示分组、Render Identity 和 Assistant Turn 组合收敛到 Transcript 模块。
- 新增 Transcript Characterization Tests。
- 保持 `ChatBubble`、`AssistantTurn` 和页面 JSX 不变。
- 完整测试、严格 seam typecheck、应用 TypeScript 检查和生产构建通过。

仍待完成：

- 全部架构迁移完成后的统一浏览器与真机交互验收。
