---
Status: Accepted
Implementation: Complete
---

# 技术 Adapter 在 App Composition Root 组装

## 当前实施结果

`main.tsx` 读取浏览器环境并调用 `createProductionDependencies()`；具体 MurmurLane Data 与 WebChat Adapter 只在 Composition Root 创建。ContentSync 与各 Workspace 接收窄 Port，Workspace 不导入具体 Adapter、环境变量、`fetch` 或 EventSource。

Conversation 搜索、Sticker 列表、Sticker 二进制加载和媒体 URL 解析已经先进入 Conversation Workspace 的窄能力边界，再作为 Commands 或页面所需 View Model 能力交付。View 不接收完整 `AppDependencies`、Token、Base URL、具体 Adapter 或 EventSource。

所有具体技术 Adapter 在 App Composition Root 创建或集中组装，并通过窄接口传入相应模块。Workspace、ContentSync 和 View 不自行创建、导入或查找基础设施依赖。当前不引入通用依赖注入框架、Service Locator 或全局可变单例。

## 当前源码事实

ADR 接受时，`main.tsx` 只渲染 `<App />` 并注册 Service Worker，尚未承担依赖组装职责；`App.tsx` 直接导入并调用 `src/data/api.ts` 中的 Conversation、Timeline、Memory、编辑和文件 SSE 能力，`useWebChat.ts` 直接导入 `chatApi.ts` 的状态、模型、发送、上传和订阅函数。上述是迁移前事实，不描述当前实现。

`chatApi.ts` 读取环境变量，确定 Base URL 和 Token，创建 HTTP 请求、超时和 EventSource，并解析媒体 URL，因此属于具体浏览器技术 Adapter。上述直接依赖是当前实现事实；本 ADR 规定后续职责迁移时的目标边界。

## Composition Root

App Composition Root 负责创建或选择生产环境 Adapter、将其组装为明确的应用依赖、把窄依赖传给 ContentSync、App Navigation 和各 Workspace、管理应用级依赖的创建与释放，并允许测试注入内存或 Fake Adapter。

Composition Root 不拥有当前线程和日期、未读规则、搜索语义、Live / Canonical 对账、删除后的选择、页面业务流程、DOM、滚动或动画。`main.tsx` 继续保持轻量；Composition Root 可以由单独模块或根组件承载，例如：

```text
main.tsx
→ createProductionDependencies()
→ AppRoot

AppRoot
├─ ContentSync + MurmurLane Data Adapter
├─ App Navigation
├─ Conversation Workspace + WebChat Adapter
├─ Timeline Workspace + Timeline Adapter
├─ Archive Workspace + Memory Adapter
└─ Views
```

具体文件名根据现有目录调整，不要求建立新的大型目录。React Hook 不得在普通模块顶层调用；如果 Workspace Controller 以 Hook 实现，应由 `AppRoot` 或相应 React 组合组件在获得依赖后调用。

## Workspace 的依赖方式

Workspace Controller 只接收自己实际使用的窄能力，例如：

```ts
useConversationWorkspace({
  contentSnapshot,
  webChat,
  navigation,
});
```

它不直接导入 `sendWebChatMessages`、`subscribeToWebChat` 或 `fetchWebChatStatus`，不读取 `import.meta.env`，不构造 Base URL、`fetch` 或 EventSource，不读取认证 Token，也不查找全局 Service Registry。Workspace 不接收完整的全局 dependencies 对象。

## Adapter 与生命周期

具体 Adapter 负责 HTTP、EventSource、Base URL、Token、认证 Header、超时、外部输入运行时校验、技术错误归一化、媒体 URL，以及技术资源的创建与释放。第一轮继续复用 `src/data/api.ts` 和 `src/data/chatApi.ts` 作为生产实现基础，通过对象包装或薄工厂适配到窄接口，不立即重写网络层。

Composition Root 创建 Adapter，但不替 Workspace 决定领域生命周期。例如 Conversation Workspace 根据 `enabled`、`threadId` 和页面状态决定何时订阅或切换；WebChat Adapter 只创建并关闭具体 EventSource。当前线程、订阅目标和切换时机仍属于 Conversation Workspace。

View 只接收 View Model 和 Commands，不接收 Adapter，也不直接执行 HTTP、SSE、上传、缓存刷新或领域对账。页面交互通过 `sendMessage`、`selectThread`、`deleteThread` 等 Command 表达。

## 测试与抽象限制

Workspace 测试可以注入 Fake Adapter，验证发送成功与失败、超时与不确定发送、线程创建与迁移、SSE 事件对账、模型切换以及删除后的选择与导航，无需启动真实 HTTP Server 或 EventSource。Fake Adapter 由真实测试需求推动，不建立通用 Mock 框架。

本 ADR 不要求为每个函数建立接口，不引入依赖注入框架、Service Locator、全局可变单例、通用 Repository 或 Adapter 基类，也不一次性重写 `api.ts` 和 `chatApi.ts`。只为 HTTP、SSE、环境配置、文件访问和导航等真实外部边界建立窄接口。

第一轮只建立 Composition Root 和最小 Adapter seam，并逐步迁移新 Workspace 或 ContentSync 的调用方。必须保持现有 API URL、请求与响应结构、Token、认证、超时、EventSource 重连、上传、媒体 URL、UI、动画、滚动以及 WebChat 实时与归档对账结果。
