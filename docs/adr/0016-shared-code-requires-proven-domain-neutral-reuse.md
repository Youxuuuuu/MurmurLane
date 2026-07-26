---
Status: Accepted
Implementation: Pending
Date: 2026-07-27
---

# ADR-0016：共享代码必须具有已证明的领域中立复用

## Context

当前源码中已有几类物理位置相近、但语义性质不同的代码：

- `src/components/layout/` 和 `src/components/controls/` 主要承载视觉与交互基础能力。
- `src/lib/conversation*.ts` 当前承载 Conversation Identity、Merge、排序、隐藏和实时/归档对账等 Conversation 领域语义。
- `ConversationPage.tsx` 和 `useWebChat.ts` 都会复用这些 Conversation 逻辑，但它们仍属于同一个 Conversation 领域。
- `src/types/conversation.ts` 与 `src/types/webChat.ts` 是 Cyberboss Conversation / WebChat 外部契约的消费侧映射，不是全应用通用领域模型。
- 现有 `AGENTS.md` 也将 `conversation*.ts` 和 `ChatBubble.tsx` 分别描述为 Conversation 语义与视觉入口。

因此，文件位于 `lib/`、`types/`，或者被多个文件调用，并不自动表示它属于共享代码。

随着 Workspace seam 建立，如果缺少共享代码准入规则，`shared/`、`common/`、`utils/`、`helpers/` 或现有 `lib/` 很容易成为无法判断所有权代码的默认投放位置。

错误的共享抽象还可能成为 Workspace 之间的隐式通信通道，绕开 Workspace 公共入口、App Navigation 和显式 Application Flow。

## Decision

代码默认归属于拥有其规则的 Workspace 或应用级模块。

只有领域中立、语义稳定，并且已经存在至少两个相互独立的真实消费方时，才提取为共享能力。

多个调用方只有代码形状相似但业务含义不同，不构成共享依据。同一 Workspace 内多个组件、Hook 或 Controller 使用，也不构成跨领域共享。

共享模块不得反向依赖 Workspace、ContentSync、具体 Adapter 或 App 业务流程。

### 所有权判断顺序

新增或迁移代码时，依次回答：

1. 这段代码包含哪个领域或应用层的规则？
2. 删除该 Workspace 后，它是否仍然具有完整、明确的意义？
3. 是否已经存在两个相互独立的真实消费者？
4. 两个消费者共享的是相同业务语义，还是只有代码形状相似？
5. 提取后是否需要传入大量领域参数、回调或策略才能维持所谓通用性？
6. 该模块是否会成为跨 Workspace 通信或绕过公共 seam 的入口？

只要代码包含某个 Workspace 的领域判断，默认留在该 Workspace。

如果一个候选共享模块必须通过大量策略参数才能适应不同领域，通常说明被抽取的是相似代码形状，而不是共同语义。

### 两个真实消费者

“两个真实消费者”指两个独立 Workspace、独立应用级模块或其他确实独立的能力所有者。

以下情况不构成两个独立消费者：

- 同一个 Workspace 下的两个组件
- 同一个 Controller 下的两个 Hook
- View 和 Controller 同时调用同一领域函数
- 实时路径和归档路径共同使用 Conversation Identity
- 两个函数参数结构相似
- 预计未来可能存在的调用方
- 测试与被测试实现

除了消费者数量，还必须确认它们需要的是相同语义，而不是仅有相似实现。

### 可以共享的能力

适合共享的能力通常只提供领域中立机制，例如：

- 无 Conversation、Timeline 或 Archive 含义的视觉 Primitive
- 通用键盘、焦点和无障碍基础处理
- 纯文本标准化
- 不决定领域日期含义的日期解析和格式化
- 基础范围、集合或字符串处理
- 被多个领域真实使用的纯技术测试能力
- 少量稳定的 App 级基础类型

即使共享，也只能提供能力，不能决定领域政策、状态所有权或页面流程。

### 不应共享的领域代码

#### Conversation

以下内容继续由 Conversation Workspace 拥有：

- Record Identity
- Live / Canonical Merge 与对账
- Transcript
- Assistant Turn
- Operation 与媒体展示分组
- 未读
- Thread 选择与 Draft Thread 迁移
- Conversation 搜索语义
- Conversation View Model 与 Commands

#### Timeline

以下内容继续由 Timeline Workspace 拥有：

- Event 分类
- Event 排序和时间范围
- Timeline Mutation Overlay
- 编辑与删除规则
- Timeline 搜索语义
- 日期可用规则
- Timeline View Model 与 Commands

#### Archive

以下内容继续由 Archive Workspace 拥有：

- Diary、Memory、Letters 和 Open Loops 内容语义
- 文档身份
- Archive Mutation Overlay
- Archive 搜索和排序
- Archive View Model 与 Commands

以下相似概念也不自动提取成通用框架：

```text
SelectionStore<T>
MutationStore<T>
WorkspaceSearch<T>
GenericWorkspaceController<T>
EntityRepository<T>
```

只有至少两个独立消费者证明它们需要完全相同的语义时，才可以重新评估。

### 搜索边界

搜索可以拆分为：

```text
领域中立文本规范化与基础匹配
→ 在两个独立领域确认语义相同后，可以共享

搜索哪些数据
结果如何排序
结果身份是什么
点击后如何解释
→ 对应 Workspace 拥有
```

共享文本匹配模块不得接收完整的：

```text
ConversationRecord
TimelineEvent
ArchiveEntry
```

它只应处理字符串、基础 Token 或其他领域中立输入。

### 媒体边界

媒体能力分为：

```text
HTTP、认证媒体 URL、文件安全访问
→ Adapter 或 Server Access

图片、文件、Sticker 与 Operation 如何组成 Conversation 展示
→ Conversation Transcript

图片预览、播放按钮和通用媒体容器
→ 在确有多个 View 消费时，可以成为视觉 Primitive
```

不得为了共享媒体代码，让 Conversation Transcript 依赖 Timeline 或 Archive 类型。

### 日期边界

日期能力分为：

```text
ISO 日期解析
日期字符串格式化
月份基础计算
→ 可能成为领域中立能力

Conversation 当前日期与历史加载
Timeline 时间范围和跨日规则
Archive 日期导航和文档身份
→ 各 Workspace 拥有
```

### App 级模块不属于共享杂物层

以下模块虽然可能只有一个直接组合方，但具有明确应用级所有权，不需要满足“两个消费者”才存在：

- App Composition Root
- App Navigation
- ContentSync
- Application Flow
- AppRoot 生命周期管理

它们应位于 `app/` 或 `content-sync/` 等明确位置，而不是放入 `shared/`、`common/` 或 `utils/`。

“两个真实消费者”是共享能力的准入条件，不是所有模块存在的准入条件。

### 共享模块的依赖方向

共享模块可以依赖：

- 语言和平台基础能力
- 其他更低层、同样领域中立的共享能力
- 必要的第三方技术库

共享模块不得依赖：

- 任意具体 Workspace
- Workspace View Model 或 Commands
- ContentSync 内部实现
- 具体 Adapter
- App Navigation 业务目标
- AppRoot
- 页面业务流程
- Cyberboss 特定领域规则，除非它本身被明确归类为外部契约消费模块

Workspace、AppRoot 和 View 可以单向使用共享能力，Shared 不得反向引用它们。

### 不建立杂物目录

当前不新增用于收容暂时无法判断所有权代码的顶层：

```text
shared/
common/
utils/
helpers/
```

若确实产生共享能力，应使用能够表达实际职责的明确名称，例如：

```text
components/controls/
components/layout/
text/
date/
test-support/
```

具体目录只有在出现真实消费者和真实文件后创建，不建立空目录。

现有 `lib/` 第一轮继续保留，但不再作为所有新逻辑的默认投放位置。

### 允许暂时重复

当第二个消费者尚未出现，或两段逻辑的共同语义尚未得到证明时，允许保留少量相似实现。

选择原则为：

```text
小范围可见重复
优先于
错误的跨领域抽象
```

第二个真实消费者出现后，再从已有实现中提取已经被证明的共同部分。

不得为了消除几行重复代码，建立通用 Store、通用 Controller 或大量策略参数。

### 跨 Workspace 协调

共享模块不得成为 Workspace 之间的隐式通信通道。

禁止建立：

```text
shared/globalWorkspaceStore
shared/domainEventBus
shared/selectionRegistry
shared/workspaceActions
```

普通跨 Workspace 跳转继续使用 App Navigation Intent。

真正跨领域的业务工作流使用明确的 Application Flow，并由 App 层组装，不通过 Shared 绕开 ADR-0003。

### 外部契约类型

`src/types/conversation.ts` 和 `src/types/webChat.ts` 可以继续作为外部契约消费侧映射。

它们被多个 Conversation 模块使用，不表示 Timeline 或 Archive 可以依赖全部契约。

新 Workspace 内部模型默认与对应 Workspace 放在一起。只有真正跨领域、语义稳定的基础类型，才进入公共类型位置。

### 对现有代码的影响

第一轮不因本 ADR 批量移动：

- `src/lib/`
- `src/types/`
- `src/components/`
- 现有测试文件

本 ADR 主要约束：

- 新增代码
- 新 seam
- 正在迁移的职责
- 因迁移而实际修改的旧代码

当某个现有文件因 seam 迁移被修改时，应重新确认其所有权，但不得借机进行无关全树整理。

### Review 检查项

新增共享模块时，应在 Review 或实施报告中说明：

- 两个独立真实消费者分别是谁
- 共享的共同语义是什么
- 哪些领域规则明确没有进入共享模块
- 共享模块的依赖方向
- 为什么代码不应继续留在某个 Workspace
- 删除任一消费者后，该模块是否仍有完整意义

若无法回答这些问题，代码默认留在所有者内部。

## Consequences

### Positive

- Conversation、Timeline 和 Archive 的规则不会因为实现相似而失去所有者。
- 共享模块保持领域中立，依赖方向更容易理解和测试。
- Workspace 之间不能利用 Shared 绕过公共 seam。
- 延迟抽取可以基于真实消费者形成更准确的共同语义。
- App 级模块可以保留明确位置，不会被“两位消费者”规则错误排除。

### Negative

- 第二个真实消费者出现前，可能保留少量可见重复。
- 每次共享提取都需要说明消费者和共同语义。
- 现有 `lib/`、`types/` 和组件目录在迁移期仍包含不同性质的代码，需要依靠所有权判断而非只看路径。

### Risks

- “领域中立”可能被宽泛解释，使领域规则换名后进入共享模块。
- 为满足两个消费者条件，可能人为制造第二个调用方。
- 小型重复可能长期无人重新评估。

这些风险通过 Review 检查项、真实消费者要求、Workspace 公共 seam 和一次迁移一个职责来控制。

## Implementation constraints

本 ADR 只建立共享代码准入规则。

当前不：

- 创建新的顶层 Shared 目录
- 搬迁现有 `conversation*.ts`
- 合并 Timeline 与 Archive 模型
- 引入通用 Selection Store
- 引入通用 Mutation Store
- 建立全局 Event Bus
- 创建通用 Workspace 框架
- 为预计中的未来需求提前抽象
- 修改源码、目录、Import、`AGENTS.md` 或 UI
