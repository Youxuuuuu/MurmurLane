---
Status: Accepted
Implementation: Complete
Date: 2026-07-27
---

# ADR-0015：区分运行时数据流与静态模块依赖方向

## 当前实施结果

`src/app/`、`src/content-sync/` 与 `src/workspaces/` 已承载真实的 Composition、Navigation、Application Flow、同步和领域 Controller。运行时仍由 App Composition Root 把 Snapshot、Ports、View Model、Commands 与现有 View 组装起来；Workspace 不因向 View 提供值而静态导入 View。

Conversation、Timeline 与 Archive 均提供窄 `index.ts` 公共入口。Workspace 外部调用方已移除对 `useConversationWorkspace.ts` 与 `webChatPort.ts` 的深层导入。架构测试现在检查 Workspace 之间的越界依赖、外部调用方的深层 Workspace Import，以及 View 对具体 Adapter 或 ContentSync 的直接依赖。

现有 `components/`、`lib/`、`types/` 与 `data/` 没有为目录整齐而批量搬迁；新 seam 单向复用其中已有且所有权明确的逻辑和外部契约映射。

## Context

当前 MurmurLane 的主要职责已经有可识别的位置：

- `src/App.tsx` 同时承担应用组装、远程数据协调、文件 SSE、页面导航和多个 Workspace 的状态协调。
- `src/data/api.ts` 与 `src/data/chatApi.ts` 是现有具体技术 Adapter。
- `src/components/` 已按 Conversation、Timeline、Archive、Layout 和 Controls 等视觉用途组织。
- `src/lib/conversation*.ts` 已承载 Conversation 的规范化、身份、合并和展示纯逻辑。
- `src/types/` 当前主要承载外部契约的消费侧类型映射。

这些是当前源码事实。`app/`、`content-sync/` 和 `workspaces/` 是迁移目标，不描述为已经存在的当前结构。

架构讨论中还需要区分两种方向：

1. **运行时数据流**描述数据和用户意图在应用运行时经过哪些职责。
2. **静态模块依赖方向**描述源文件在编译时允许导入哪些模块。

两者不能画成同一条箭头。例如运行时由 Workspace 产生 View Model 并交给 View，不代表 Workspace 源码应当导入 View。实际组装应由 App Composition Root 完成。

如果不明确这一区别，迁移后容易出现新的循环依赖、Workspace 直接引用页面组件、View 深入 Controller 内部，或 Adapter 反向依赖领域实现。

## Decision

新架构采用 `app/`、`content-sync/` 和 `workspaces/` 作为应用组装、内容同步和领域所有权的稳定位置。

现有 `data/`、`components/`、`lib/`、`types/` 和 `config/` 在第一轮保留，并由新 seam 渐进接管；不进行全目录搬迁。

Workspace 之间不得互相导入。View 不得直接依赖具体 Adapter、ContentSync 内部实现或 Controller 内部状态。

### 目标位置

目标结构表达职责位置，不要求第一轮一次性创建全部目录：

```text
src/
  app/
    AppRoot.tsx
    composition/
    navigation/
  content-sync/
  workspaces/
    conversation/
    timeline/
    archive/
  data/
  components/
  lib/
  types/
  config/
```

只有出现真实实现文件时，才建立 `controller/`、`model/`、`commands/`、`transcript/` 或 `ports/` 等子目录。

初始 Workspace 可以保持较平，例如：

```text
workspaces/conversation/
  index.ts
  useConversationWorkspace.ts
  conversationWorkspaceTypes.ts
  webChatPort.ts
  buildConversationTranscript.ts
```

不为预测中的未来复杂度创建空目录。

### 运行时数据流

主要读取路径为：

```text
ContentSync Snapshot
→ Workspace Controller
→ View Model + Commands
→ View
```

用户操作路径为：

```text
View
→ Command
→ Workspace Controller
→ Domain Port
→ Concrete Adapter
```

跨 Workspace 导航路径为：

```text
Calling Workspace
→ typed navigation intent
→ App Navigation
→ target Workspace
```

这些箭头表示运行时值、事件和意图的传递，不直接表示源码 import 方向。

### 静态模块依赖方向

#### App Composition Root

Composition Root 可以依赖：

- 具体 Adapter
- ContentSync 的公共入口
- App Navigation 的公共入口
- 各 Workspace 的公共入口
- 页面 View

它负责在运行时把 Snapshot、Port、Navigation、View Model 和 Commands 组装起来。

它不得拥有线程选择、未读、搜索、对账、保存回滚或页面领域流程。迁移不得把当前 `App.tsx` 的复杂度原样复制成新的巨型 `AppRoot`。

#### Workspace

Workspace 可以依赖：

- 自己的领域模型、Commands、Ports 和纯逻辑
- ContentSync 的只读公共 Snapshot 类型或接口
- App Navigation 的窄公共接口
- 当前已有且由该领域拥有的纯逻辑，例如 `conversationIdentity`、`conversationMerge` 和 Assistant Turn 模型
- 必要的外部消费侧契约类型

Workspace 不得依赖：

- 另一个 Workspace 的内部模块
- `api.ts`、`chatApi.ts` 等具体 Adapter
- `fetch`、`EventSource`、环境变量或认证 Token
- View、DOM、React ref、滚动和动画实现

Workspace 不通过导入目标 Workspace 来完成导航或业务协作。

#### Concrete Adapter

具体 Adapter 实现消费方定义的窄 Port，并可以依赖：

- HTTP、SSE、文件或浏览器能力
- Base URL、Token 和环境配置
- 外部输入校验
- 技术错误归一化

Adapter 不得依赖 Workspace Controller 的实现，不得决定 Workspace 的业务流程或展示结果。

Port 的接口由使用能力的领域拥有。不得为了包装现有函数而复制 `api.ts` 或 `chatApi.ts` 的全部表面，也不建立通用 Adapter 基类。

#### View

View 可以依赖：

- 视觉组件
- Workspace 公开的 View Model 类型
- Workspace 公开的 Commands 类型

View 不得依赖：

- 具体 Adapter
- ContentSync 内部 Store、缓存或失效实现
- Controller 内部 Store、setter 或私有状态
- 其他 Workspace 的内部模块

View 在运行时接收 View Model 和 Commands；Workspace 无需也不得因此静态导入 View。

#### ContentSync

ContentSync 可以依赖数据读取与同步所需的窄 Port、Snapshot 类型和技术同步能力。

ContentSync 不得依赖：

- Workspace 业务模型
- Workspace Controller
- Workspace View Model
- 页面 View
- 搜索、未读、线程选择或页面跳转等领域规则

### Workspace 公共入口

每个 Workspace 应提供稳定、窄的公共入口，例如：

```text
workspaces/conversation/index.ts
```

外部调用方只从该入口导入被明确公开的 Controller 创建方式、View Model、Commands、Target 或 Port 类型。

不得通过深层路径导入 Workspace 内部实现，也不得使用无选择的 `export *` 将全部内部模块暴露出去。

Workspace 之间如果需要协调，使用 App Navigation、ContentSync Snapshot 或显式 Application Flow，不通过彼此的公共入口调用内部业务能力。

### 现有目录的渐进处理

#### `components/`

第一轮保留现有组件路径。

`ChatBubble`、`AssistantTurn` 以及现有 Timeline、Archive、Layout 和 Control 组件不因建立 Workspace 而迁移。只有当真实所有权和迁移收益明确时，才单独讨论组件位置。

#### `lib/`

第一轮继续复用现有 Conversation 纯逻辑，不复制、不批量移动，也不重新实现竞争规则。

新增的 Workspace 特有业务逻辑进入对应 Workspace。只有真正跨领域、稳定且不包含领域语义的能力，才有资格进入通用位置；不得继续把不知归属的逻辑默认放入 `lib/`。

#### `types/`

现有 Conversation 与 WebChat 类型继续作为外部契约的宽容消费侧映射。

新增 Workspace 内部模型优先与拥有它的 Workspace 共置。只有确实被多个领域共同拥有且语义稳定的类型，才进入公共类型位置。

消费侧契约类型不因被多个文件使用，就自动成为跨领域业务模型。

### 明确禁止的依赖

```text
View
  -X-> api.ts / chatApi.ts
  -X-> ContentSync internals
  -X-> Controller setters or internal store

Workspace
  -X-> another Workspace internals
  -X-> concrete HTTP / SSE Adapter
  -X-> View / DOM / animation implementation

ContentSync
  -X-> Workspace business rules
  -X-> Workspace View Model
  -X-> View

Concrete Adapter
  -X-> Workspace Controller implementation
```

### 迁移期共存

迁移期间允许现有结构与目标结构共存，但共存必须受控：

- 每次只迁移一个已确认 seam。
- 新 seam 使用目标依赖方向。
- 旧调用链只在当前阶段必要的范围内保留。
- 不建立两套长期竞争的 Controller、Transcript、同步状态或业务规则。
- 不为了目录整齐复制逻辑。
- 不要求后续所有阶段完成后当前阶段才能运行。

### 约束的执行方式

第一轮通过以下手段执行依赖边界：

- Workspace 公共入口
- 窄 Port
- TypeScript 类型与严格 seam 检查
- Characterization Tests
- Code Review 和明确的 import 约定

当前不因本 ADR 引入 Dependency Cruiser、额外 ESLint 插件或自定义架构框架。

只有真实、重复的越界依赖无法通过现有检查稳定发现时，再评估自动化依赖规则。

`AGENTS.md` 继续作为仓库实际协作规则。它应在对应 seam 真正实施时同步更新，不提前把目标目录写成当前事实。

## Consequences

### Positive

- 数据流和源码依赖不再混为一谈。
- Composition Root 可以完成运行时组装，而不把 Workspace 与 View 静态耦合。
- Workspace 所有权、测试替身和替换技术 Adapter 的边界更清楚。
- 新架构可以与现有目录渐进共存，避免大规模搬迁造成无价值 Diff。
- Conversation 现有纯逻辑和视觉组件可以继续复用，降低 UI、滚动和动画回归风险。

### Negative

- 迁移期会暂时存在旧目录和新 Workspace 并存的情况。
- 开发者需要同时判断运行时协作和静态 import 是否合理。
- 窄公共入口和 Port 会增加少量显式组装代码。
- 在没有立即引入自动依赖检查工具时，边界仍需要类型检查、测试和评审共同维护。

### Risks

- `AppRoot` 可能重新变成新的业务控制器。
- Workspace `index.ts` 可能通过过度导出失去封装。
- `lib/`、`types/` 或未来的 `shared/` 可能成为无法判断所有权的杂物区。
- 为追求目录一致性，可能过早移动现有组件和纯逻辑，制造无关风险。

这些风险通过窄入口、领域所有权优先、一次迁移一个 seam、无真实使用方不抽象，以及 Characterization Tests 先行来控制。

## Implementation constraints

本轮只记录决策，不修改：

- 源码
- 现有 import
- 目录布局
- `AGENTS.md`
- 构建与 lint 配置
- JSX、CSS 和 DOM
- 滚动、窗口化和动画

第一轮实施时：

- 只创建承载真实代码的目录和文件。
- 不进行全树搬迁。
- 不创建空的分层目录。
- 不复制现有 Conversation 逻辑。
- 不引入状态管理框架、依赖注入框架、Service Locator 或 Adapter 基类。
- 不以架构迁移为理由改变当前可观察行为。
