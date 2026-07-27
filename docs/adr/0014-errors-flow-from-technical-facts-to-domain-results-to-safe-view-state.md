---
Status: Accepted
Implementation: Partial
---

# 错误从技术事实流向领域结果和安全 View State

## 当前实施范围

Timeline 与 Archive Workspace 已将 Adapter 异常转换为各自的安全 Command Error，View 不再读取 `ApiError.bodyText`，也不会接收路径、Token、Stack 或原始 Cause。错误仍显示在原有 Inline Error 位置，JSX、CSS、DOM 和交互未改变。

本次明确的安全行为变化是：Timeline、Archive 与 Xiaoye 编辑失败时，不再把未经筛选的 Server Body 直接显示给用户，而改用稳定中文文案。Conversation 的 `failed / unknown` 事务解释继续保留既有领域规则。浏览器 Adapter 的统一技术错误归一化、ContentSync 安全错误元数据和 Server 领域错误分层仍随对应后续 seam 实施，因此本 ADR 保持 `Partial`。

Adapter 只产生经过归一化、不包含展示决策的技术错误；Workspace 将技术错误解释为领域结果、领域错误和可执行恢复动作；View Model 暴露安全、稳定的用户展示状态，View 按现有 UI 渲染并触发 Command。预期且可恢复的失败使用明确结果表示，违反程序不变量的异常不得被伪装成普通业务错误。Server 领域错误由 Router 映射为 HTTP，页面不得直接依赖 HTTP 状态码决定领域行为。

## 当前源码事实

`src/data/api.ts` 定义 `ApiError`，保存 `status`、`statusText`、`path` 和原始 `bodyText`，HTTP Response Body 会进入 `bodyText`。`src/data/chatApi.ts` 定义 `WebChatHttpError`、`WebChatSendTimeoutError` 和 `WebChatUploadTimeoutError`；HTTP 错误可以直接使用 Server Response Body 作为 message，上传超时错误已经包含中文展示文案，说明技术错误与用户提示尚未完全分离。

`useWebChat.ts` 主要将错误压缩为字符串状态，但已经实现发送超时或网络模糊错误不直接判定失败，而是查询发送状态并区分 accepted、failed 和 unknown 的领域规则。Memory、Xiaoye 和 Timeline 编辑 View 当前直接读取 `error.bodyText` 或 `error.message` 作为页面文字。

Server 当前存在路由级 `400/403/404` 等响应，未识别异常由统一 Handler 返回现有 `500` JSON。上述是当前运行事实，本 ADR 规定后续迁移目标。

## Adapter 技术错误

Adapter 归一化网络、HTTP、Timeout、Abort、取消、EventSource 断开、JSON 和协议解析失败，保留原始 cause 供诊断和日志使用，隔离敏感信息，并提供技术层面的重试提示。具体类型由真实调用方决定，不建立全局通用错误框架。

Adapter 不决定消息是否重新发送、Mutation Overlay 是否回滚、线程与日期跳转、最终用户能否重试，也不生成 Banner、Toast、Modal 或页面布局。

技术层 `retryHint` 只表示技术上可能重试，不等于 View 的 `canRetry`。发送 Timeout 可能已经送达，Conversation Workspace 必须先查询状态并得出 sent、failed 或 unknown，再决定是否提供使用相同 requestId 的重试。View 不根据 HTTP status、Error Class 或字符串匹配判断领域结果。

预期取消包括 Workspace 失活、View 卸载、新请求替代旧请求、ContentSync 丢弃旧 Generation、主动 Abort 和应用关闭资源。Adapter 可以将其归一化为 cancelled，Workspace 默认忽略；只有取消改变已提交用户操作的结果时，才解释为明确领域状态。

## Workspace 领域解释

每个 Workspace 定义自己的最小领域结果和错误，不建立包含所有业务的巨型 `AppError`。Workspace 将 Technical Error 映射为 failed、conflict、unknown、offline 或 waiting-for-sync 等领域结果，决定 Mutation Overlay 的保留、回滚或等待确认，将错误关联到具体 Command、Thread、Message、Event 或 Document，决定重试、刷新或重新认证，并生成安全 View Model 展示状态。

预期且用户可恢复的失败，例如网络断开、无权限、保存冲突、上传超时、发送状态未知、Content Source 加载失败和远端记录不存在，使用明确领域结果或领域错误表示。每个 Workspace Command 的公开契约必须说明预期失败通过结果返回还是领域错误状态表达，同一 seam 不混用 throw、false、字符串和 Result 等不明确约定。

不变量破坏、Controller 非法状态、必需依赖缺失、Transcript 不可能结构和 Mutation Sequence 约束违反属于程序错误，不得压缩成普通操作失败；它们通过测试、开发日志、监控或诊断、React Error Boundary 或应用级故障状态暴露。React Error Boundary 不替代 Workspace 对异步 Command 预期失败的处理。

## View Model 与 View

View Model 只暴露经过 Workspace 选择的安全用户文案、动作标识和按钮文字。View 按当前位置与样式渲染 Inline Error、Banner、按钮和动画，用户操作后调用对应 Command。

View 不接收原始 Error、`ApiError.bodyText`、stack、Adapter cause、HTTP Header、Server 文件路径、Token 或 Express 映射细节，也不通过 HTTP status、Error Class 或字符串匹配决定领域行为。

Token、Authorization Header、绝对路径、stack、未经筛选的 Server Body、内部请求对象和 EventSource 不得进入 View Model。若当前原始错误文字存在敏感信息泄露风险，安全优先于文字完全保持，但必须将修复标记为明确的安全行为变化，不能混入普通重构。

## ContentSync 与 Server 错误

ContentSync 拥有每个 Content Source 的同步错误和连接状态，包括 data、status、error、updatedAt、connection 和 revision。加载或重连失败时，根据当前行为保留最后有效 Snapshot；Workspace 决定这对页面意味着继续显示旧数据、空状态、retry Command 或等待自动重连。本 ADR不提前统一所有 Content Source 的错误 UI。

Server 错误链是：

```text
Server Domain Error
→ Router 映射为现有 HTTP 状态与 JSON
→ Browser Adapter 归一化为 Remote / Technical Error
→ Workspace 解释领域意义
→ View Model 提供安全状态
→ View 渲染
```

Server 领域模块不依赖 Express，也不生成页面文案。Router 负责 HTTP 状态、当前响应 JSON、输入与访问控制错误映射，以及未识别异常的统一 500。第一轮保持现有 URL、状态码和 JSON 错误结构。稳定 errorCode、Correlation ID 或版本化错误协议如有真实需求，作为向后兼容契约变化另行决策。

## 实施与 Characterization

错误迁移随相应 seam 渐进进行：Browser Adapter 技术错误归一化、Workspace 领域结果、View Model 安全错误状态、View 移除原始 Error 依赖。第一轮不一次性重写全部错误处理，也不引入错误框架。

实施前刻画 `ApiError` 的状态和文字、Timeline 与 Memory 保存失败、Open Loops 回滚、WebChat 明确失败与模糊超时状态查询、accepted 与 unknown、相同 requestId 重试、上传超时、EventSource 断开、ContentSync 旧数据保留、取消不产生用户错误、View Model 敏感信息隔离、Server 400/403/404/500，以及程序错误不被压成业务失败。

第一轮必须保持现有错误 UI、Banner、Inline Error、按钮位置、安全用户文案、发送 failed / unknown、上传超时、Timeline 与 Memory 回退、Open Loops 回滚、ContentSync 加载结果、Server 状态与 JSON、JSX、CSS、DOM 和动画。不得引入全局 Error Store、巨型 `AppError`、通用 Toast 框架、新错误 UI、Server 错误协议大改或基于字符串匹配的领域逻辑。
