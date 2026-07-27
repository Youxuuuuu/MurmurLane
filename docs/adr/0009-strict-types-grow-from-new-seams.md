---
Status: Accepted
Implementation: Partial
---

# 严格类型从新 seam 向旧代码渐进扩展

## 当前实施进度

新增 `tsconfig.server.json` 与 `npm run typecheck:server`，覆盖 `server/index.ts`、`app.ts`、Router、领域模块、Read Model、Live Update 和 Server Access，并补充 `@types/node` 与 `@types/express` 直接类型依赖。Server strict typecheck 已通过，没有使用 `@ts-nocheck` 或大范围 `any` 掩盖问题。

新增浏览器 seam 继续由 `tsconfig.strict.json` 检查。`ConversationPage.tsx` 的 `@ts-nocheck` 已移除，并为 Workspace View Model、Commands、Transcript、DOM 元素、滚动原因和诊断快照补齐明确类型；`App.tsx` 仍按既定顺序留到最后，因此本 ADR 保持 `Partial`。

新架构 seam 默认采用严格类型，API、SSE、JSONL、Markdown、文件和环境变量等外部数据在 Adapter 边缘进行运行时校验。旧大型文件随职责迁移渐进收紧，不进行一次性全项目类型重写，并将 MurmurLane Server 纳入独立 typecheck。

## 当前源码事实

`tsconfig.app.json` 当前为 `strict: false`；`App.tsx` 和 `ConversationPage.tsx` 使用 `@ts-nocheck`；`tsconfig.node.json` 只包含 `vite.config.ts`；根 `tsconfig.json` 没有引用 Server TypeScript 项目。`npm run build` 执行 `tsc -b && vite build`，但 `server/` 没有进入该 TypeScript build。

`chatApi.ts` 当前通过泛型类型断言读取 HTTP JSON，并将 SSE 的 `JSON.parse` 结果断言为 `WebChatEvent`；这些断言不构成运行时契约校验。Conversation 和 WebChat 消费类型保留可选字段、未知扩展字段和部分开放字符串，以兼容现有与未来 Cyberboss 数据。

## 新 seam 的严格类型

ContentSync Snapshot 与同步元数据、Workspace Controller、Workspace View Model、Commands、App Navigation Target、Conversation Transcript、Server 领域模块、Server Router 与领域模块之间的输入和结果，以及新增 Adapter 的解析结果，默认使用严格类型。

每个 seam 显式声明输入、输出、错误、可选字段、不变量和兼容回退，不得通过 `any`、无校验类型断言或新增 `@ts-nocheck` 绕过边界。

由于当前应用配置为 `strict: false`，实施时必须建立可执行的严格检查配置，例如 `tsconfig.strict.json`，覆盖已经迁出的新 seam。具体 `include`、项目引用和模块边界根据真实依赖设计，不得为了通过严格检查而把整个旧 `App.tsx` 或 `ConversationPage.tsx` 过早拖入一次性整改。可以增加 `typecheck`、`typecheck:strict` 和 `typecheck:server` 等脚本，最终命令由实施阶段依据实际配置确定。

## Server typecheck

新增独立 `tsconfig.server.json`，使 `server/index.ts`、`server/app.ts`、Router / HTTP Adapter、Conversation Read Model、Timeline、Memory、Media、Live Update 领域模块和 Server Access 能力进入 TypeScript 检查。

根据首次真实编译结果补齐 Node 与 Express 的直接类型依赖，不得使用大范围 `any` 或 `@ts-nocheck` 掩盖问题。第一阶段可以将 Server typecheck 作为独立脚本；是否立即纳入默认 build 或 CI 阻断，根据初次检查暴露的历史问题另行决定，避免把服务端分层与一次性类型整改混为一体。

## 外部输入校验

HTTP JSON、SSE Event、Conversation JSONL、Markdown 解析输入、Timeline 与 Memory 文件内容、URL、Query、Body、环境变量、文件系统元数据和 Cyberboss WebChat 契约数据，在进入领域 seam 前均视为 `unknown`。Adapter 将其校验、归一化为领域输入。

运行时校验只覆盖当前消费方真正依赖的最小不变量；必须字段错误时返回明确错误，可选字段缺失时保留兼容行为，Cyberboss 向后兼容新增的未知字段不得被无理由拒绝。不要求立即引入 Zod 或其他验证框架，优先复用并集中当前已有的真实校验规则，不得仅通过 `as SomeType` 宣称外部数据已经安全。

现有 `src/types/conversation.ts` 和 `src/types/webChat.ts` 继续作为宽容的消费侧契约映射。经过 Adapter 校验后，新 Workspace 和 Transcript seam 可以使用更明确的领域类型，但不得改写 Cyberboss Canonical Record 语义、丢弃合法兼容字段、发明竞争生产契约或将 View Model 写回为 Canonical Record。

## 渐进收紧顺序

```text
新 seam 默认严格
→ Server 独立 typecheck
→ Conversation Transcript 与 Workspace 职责迁出
→ 移除 ConversationPage.tsx 的 @ts-nocheck
→ App.tsx 职责迁出
→ 最后处理 App.tsx 的 @ts-nocheck
```

不得为了移除 `@ts-nocheck` 改变 Conversation 数据兼容性、JSX、CSS、DOM 结构、滚动与锚点、Framer Motion 动画、Live / Canonical 对账结果或当前运行行为。

本 ADR 不要求现在或在固定阶段将整个项目切换为 `strict: true`。当新 seam、Server 和大型旧文件完成渐进收紧后，再根据剩余错误范围和实际收益决定是否为全项目 strict 提出新的 ADR。
