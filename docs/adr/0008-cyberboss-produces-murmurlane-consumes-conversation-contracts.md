---
Status: Accepted
Implementation: Complete
---

# Cyberboss 生产 Conversation 契约，MurmurLane 消费

Cyberboss 是 Canonical Conversation Record、Conversation Archive、WebChat 传输事件和现有 WebChat 命令的权威生产端；MurmurLane 是这些契约的消费、适配、对账与展示端。MurmurLane 可以拥有 Transcript、View Model 和瞬时视觉状态，但不得自行定义一套与 Cyberboss 竞争的 Canonical 生产契约。

## 已验证的当前事实

当前 Cyberboss 源码在 `src/custom/xiaoye/conversation/` 中校验、生成并写入 Canonical Conversation Record，Cyberboss 是 Conversation Archive 的写入方。Cyberboss 的 MurmurLane WebChat 模块负责发送契约归一化、HTTP 路由以及消息进入 Cyberboss 的流程。

MurmurLane 消费 Conversation Archive 和 WebChat 契约，并将其适配为 Transcript、View Model 和 UI；它不直接调用 Codex 或 ClaudeCode Runtime，也不直接写入 `conversations/*.jsonl`。当前存在正式线程选择接口，但不存在用户操作意义上的正式线程删除命令；Cyberboss `writer.js` 中的 deletion state 用于导入来源删除追踪，不等同于产品功能中的删除线程。

## MurmurLane 的消费侧语义

MurmurLane 可以定义并拥有 `ConversationTranscript`、`ConversationDisplayItem`、Workspace View Model、Commands、搜索结果模型，以及滚动、动画和其他瞬时视觉状态。这些类型只用于消费与展示，不得写回或宣称为 Canonical Conversation Record。

`src/types/conversation.ts` 和 `src/types/webChat.ts` 是消费侧类型映射，不是生产契约的权威来源。

## 跨仓库契约变化

任何改变 Conversation Record 字段、WebChat 事件、媒体结构、线程或消息命令、Runtime 状态、语音、通话或 Usage 的功能，都必须使用共享 tracker 并标记 `Repo: both`。协作顺序是：

```text
Cyberboss 明确生产契约
→ Cyberboss 实现生产与服务端行为
→ MurmurLane 更新消费类型和 Adapter
→ Workspace 更新领域流程
→ View 更新展示
```

MurmurLane 不得通过猜测字段形状或直接读取 Runtime 原始格式绕过 Cyberboss 契约。

## 未来线程删除

正式线程删除目前只是候选能力，不是现有功能。设计时必须先由 Cyberboss 明确删除 Conversation Archive 还是 Runtime 原始线程、是否写入 Tombstone、重新导入是否允许恢复、如何处理正在运行的线程、删除后的当前线程状态，以及与 Channel、搜索、Usage 和其他引用数据的关系。

在 Cyberboss 提供正式命令和 WebChat 接口后，MurmurLane 只通过该接口执行删除；Conversation Workspace 负责确认、请求状态、删除后的选择和跳转。MurmurLane Server 不得直接修改或删除 Conversation JSONL。

## 共享契约包

当前不建立共享契约包，也不提前设计发布和版本体系。只有两仓库重复维护契约已经造成明确、持续的漂移，并且发布、版本、迁移和本地开发方式得到确认后，才单独提出 ADR，在共享 Package、JSON Schema、代码生成或其他契约分发方式之间作出选择。

目前通过生产端权威定义、消费侧类型映射和跨仓库契约测试保持一致。

## ADR 实施状态

`Status` 表示决策是否已被接受，`Implementation` 表示当前源码对该决策的实现程度：

- `Pending`：目标 seam 尚未建立。
- `Partial`：已有部分职责分离，但尚未达到 ADR 规定的目标结构。
- `Complete`：当前源码和行为符合 ADR。

前七条 ADR 是已经接受的目标架构，不代表当前源码已经完成迁移。后续实施计划必须以各 ADR 的 `Implementation` 为准，不得把目标结构描述成当前已经存在的结构。

## Clarification — 2026-08-03

本节补充而不改写上述历史表述。Conversation、Usage、语音、通话或媒体这些主题名称本身不决定 `Repo: both`；只有生产契约与消费者都需修改、Record/媒体/身份语义跨越边界、两仓库存在独立缺陷，或一侧无法在兼容条件下独立发布时，才使用 `Repo: both`。

生产契约不变的 Browser Adapter、ContentSync、Workspace、Live/Canonical 对账、Transcript、View Model、视觉和交互属于 `Repo: murmurlane`。消费契约不变的 Runtime、Channel、Archive 写入或生产契约缺陷属于 `Repo: cyberboss`。发布顺序由兼容性决定，不从“Cyberboss 是生产端”推导出固定顺序。

完整判定规则：本地 [`../murmurlane-stack/docs/repository-map.md`](../../../murmurlane-stack/docs/repository-map.md) 与 [`../murmurlane-stack/docs/workflow/cross-repo-diagnosis.md`](../../../murmurlane-stack/docs/workflow/cross-repo-diagnosis.md)；GitHub：[repository map · main](https://github.com/Youxuuuuu/murmurlane-stack/blob/main/docs/repository-map.md) 与 [diagnosis · main](https://github.com/Youxuuuuu/murmurlane-stack/blob/main/docs/workflow/cross-repo-diagnosis.md)。
