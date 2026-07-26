---
Status: Accepted
Implementation: Pending
Date: 2026-07-27
---

# ADR-0018：浏览器公开配置与 Server Secret 使用独立边界

## Context

浏览器侧当前存在：

- `src/data/api.ts` 在模块导入时读取 `VITE_API_BASE_URL` 和 `VITE_MURMURLANE_EDIT_TOKEN`。
- `src/data/chatApi.ts` 在模块导入时读取 `VITE_MURMURLANE_CHAT_API_BASE_URL`、`VITE_MURMURLANE_CHAT_TOKEN` 和 `DEV`。
- `api.ts` 在模块初始化时生成 `API_BASE_URL`、`EDIT_TOKEN` 与 `HAS_EDIT_TOKEN`。
- `chatApi.ts` 在模块初始化时确定 WebChat Base URL、Token、发送超时和上传超时。
- WebChat Token 当前进入 `X-Cyberboss-Web-Token`、`Authorization: Bearer`、EventSource Query 和媒体 URL Query。
- `App.tsx`、`ConversationPage.tsx`、`DiarySearchBox.tsx` 和 `searchPageData.ts` 存在直接 Build Env 读取，主要用于开发断言、指标和性能日志。
- `registerServiceWorker.ts` 使用 `import.meta.env.PROD` 决定是否注册 Service Worker。

Server 当前存在：

- `server/index.ts` 先加载 `.env.local`，再加载 `.env`。
- `server/index.ts` 读取 `API_HOST`、`PORT`、`API_PORT`、`API_FILE_MAX_BYTES` 和 `MURMURLANE_EDIT_TOKEN`。
- `server/fileLoaders.ts` 直接读取 `CYBERBOSS_DATA_ROOT`。
- `MURMURLANE_EDIT_TOKEN` 当前会在请求鉴权期间重新读取。
- Server 配置分散在启动入口、文件模块和请求处理路径中。

这些是当前实现事实。本 ADR 描述目标配置边界，不表示当前已经完成集中解析。

## Decision

浏览器配置与 Server 配置分别在各自的 Composition Boundary 读取、校验并形成只读类型化快照。

浏览器 Composition Boundary 只处理公开配置和浏览器可见凭据，并将最小配置传给具体 Adapter。

Server `index.ts` 读取进程环境，将最小配置或由配置创建的安全能力传给 `createApp()`、领域服务与 Server Access。

Workspace、ContentSync、View Model 和领域纯逻辑不得直接读取 `import.meta.env` 或 `process.env`。

所有进入浏览器构建的 `VITE_*` 值均视为浏览器公开信息，不得承载新的 Server-only Secret。

### 配置生命周期

需要区分：

```text
浏览器配置
→ Vite 构建时快照
→ 修改后需要重新构建前端

Server 配置
→ Server 启动时快照
→ 修改后需要重启进程
```

配置对象在应用或进程生命周期中保持只读。

本 ADR 不支持通过运行中修改 `import.meta.env` 或 `process.env`，动态改变已经创建的 Adapter、Data Root、认证或端口。

当前 `fileLoaders.ts` 和 Edit Token 会在运行过程中重新读取 `process.env`。迁移到启动快照后，运行中改变环境变量不再即时生效；目标行为明确为“修改配置需要重启或重新构建”。

### 浏览器公开配置

浏览器 Composition Boundary 可以形成只读配置，例如：

```ts
type BrowserPublicConfig = Readonly<{
  murmurLaneApiBaseUrl: string;
  webChatApiBaseUrl: string;
  editCredential?: string;
  webChatCredential?: string;
  diagnostics: {
    appDebug: boolean;
    conversationMetrics: boolean;
    searchPerformance: boolean;
  };
}>;
```

名称只是职责示例，不要求实现使用完全相同的类型。

推荐流程：

```text
import.meta.env
→ parseBrowserConfig()
→ createProductionDependencies(config)
→ concrete adapters
→ ContentSync / Workspaces
```

`AppRoot` 不负责逐项解析环境变量。它只接收已经创建好的 Dependencies、Navigation 和必要的应用级诊断配置。

### 浏览器 Token 的安全分类

所有被前端代码读取的 `VITE_*` 值均视为浏览器可见。

当前：

```text
VITE_MURMURLANE_EDIT_TOKEN
VITE_MURMURLANE_CHAT_TOKEN
```

应描述为：

```text
Browser-visible credential
或
Browser-visible bearer credential
```

“Capability Token”一词只有在不暗示其无法被用户提取、转发或复用的前提下才可使用。

当前编辑 Token 和 WebChat Token 的传递与认证行为在第一轮保持不变。本 ADR 不修改：

- Header 名称
- Bearer Header
- EventSource Query Token
- 媒体 URL Query Token
- Server 校验方式

如果未来需要防止终端用户获得或复用这些凭据，必须单独设计：

- 用户身份
- 登录
- 会话签发
- 权限范围
- Token 轮换
- 部署边界
- CSRF 与跨站访问
- Cyberboss WebChat 认证契约

不能只通过重命名环境变量实现。

### 浏览器 Adapter 的最小配置

具体 Adapter 只接收自己需要的最小配置，例如：

```ts
createWebChatAdapter({
  baseUrl,
  credential,
  sendTimeoutMs,
  uploadTimeoutMs,
});
```

```ts
createMurmurLaneDataAdapter({
  baseUrl,
  editCredential,
});
```

Adapter 不接收完整 `BrowserPublicConfig`。

具体 Adapter 继续负责：

- URL 构造
- Header
- EventSource Query
- 媒体 URL
- Timeout
- Abort
- 技术错误归一化
- 外部响应校验

Workspace 不知道：

- Token
- Base URL
- Header
- Query 认证
- EventSource 构造
- Timeout 实现

### 保持当前浏览器行为

第一轮必须保持：

- `VITE_API_BASE_URL` 缺失时使用当前同源 API。
- 开发环境 WebChat 缺省使用 `http://127.0.0.1:8791`。
- 生产环境 WebChat 缺省回退到 MurmurLane API Base URL。
- Base URL 当前去除末尾 `/` 的规则。
- 当前编辑 Token Header。
- 当前 WebChat 两种认证 Header。
- 当前 EventSource Token Query。
- 当前媒体 URL Token Query。
- 当前 15 秒发送超时。
- 当前 120 秒上传超时。
- 空白 Token 按未配置处理。
- 当前 `HAS_EDIT_TOKEN` 导致的页面编辑能力判断。

第一轮允许通过兼容 Facade 保留现有 `API_BASE_URL`、`HAS_EDIT_TOKEN` 等出口，直到调用方迁入新的 Adapter 和应用配置 seam。

### Workspace 与 ContentSync

以下模块不得直接读取 `import.meta.env`：

- Workspace Controller
- Workspace Model
- Commands
- Conversation Transcript
- Search 领域规则
- Mutation Overlay
- ContentSync Controller
- View Model 推导

Conversation Workspace 只接收 WebChat Port。

ContentSync 只接收数据读取、刷新与订阅 Port。

测试通过 Fake Port 和显式依赖完成，不需要修改全局 Vite Env 或重新导入模块。

### View 与诊断配置

View 不根据环境变量决定领域行为。

现有开发指标和性能日志应逐步迁到窄诊断边界，例如：

```text
App Diagnostics Config
Instrumentation Port
或
明确的 View 诊断 Prop
```

纯诊断开关不要求进入 Workspace 领域 View Model，除非它实际改变用户可观察的渲染状态。

`searchPageData.ts` 等确定性领域函数不应直接读取 Build Env。需要性能测量时，可以：

- 由调用方传入明确的 `perfEnabled`
- 在外层 Instrumentation Wrapper 中测量
- 使用领域中立的诊断能力

不得让纯逻辑自行寻找全局配置。

### Build Mode 的有限例外

以下启动或基础设施模块可以直接使用 Build Mode：

```text
main.tsx
registerServiceWorker.ts
browser config parser
production dependency factory
```

例如 `registerServiceWorker.ts` 使用 `PROD` 决定是否注册 Service Worker，可以继续保留。

原则不是机械消除所有 `import.meta.env`，而是把读取限制在浏览器启动、配置解析和基础设施边界。

### Server 配置

Server 可以形成只读配置，例如：

```ts
type ServerConfig = Readonly<{
  host: string;
  port: number;
  dataRoot: string;
  editToken?: string;
  apiFileMaxBytes: number;
  staticDistDirectory: string;
}>;
```

推荐流程：

```text
server/index.ts
→ 加载 .env.local
→ 加载 .env fallback
→ parseServerConfig(process.env)
→ 创建 Server Access、Authorization 与领域服务
→ createApp(dependencies)
→ listen
```

`server/index.ts` 保留：

- Dotenv 加载
- Process Env 读取
- 配置校验
- 进程启动和关闭
- `listen`

`server/app.ts`、Router、领域服务、文件能力和 Live Update Service 不再直接读取 `process.env`。

### Server Secret 转换为能力

Server Secret 不应作为完整 Config 对象向所有模块扩散。

例如：

```text
editToken
→ createEditAuthorization()
→ Router 使用 Authorization Capability
```

```text
dataRoot + apiFileMaxBytes
→ createServerAccess()
→ 文件与媒体领域模块使用安全访问能力
```

Timeline、Memory 和 Conversation Read Model 不应收到不需要的编辑 Token。

Router 不应自行重新读取 `process.env`。

配置对象、Token 和 Data Root 不得进入：

- HTTP 成功响应
- ContentSync Snapshot
- Workspace View Model
- 浏览器日志
- 用户错误 UI

### 配置校验

环境变量属于不受信任外部输入。

每个配置项应分别定义：

- 缺失行为
- 空白行为
- 非法值行为
- 默认值
- 是否启动失败
- 是否禁用对应能力

至少覆盖：

- Host
- Port
- Data Root
- 文件大小限制
- Base URL
- 空白 Token
- Timeout
- Dist Directory

不得笼统规定所有非法值都回退，或所有非法值都终止启动。

已有行为应保持，例如：

- `API_FILE_MAX_BYTES` 非法或非正数时回退到当前 25 MB。
- 编辑 Token 为空时保持编辑禁用。
- 可选 URL 缺失时保持当前回退。

对于当前没有明确安全回退的非法配置，例如非法 `PORT` 产生非有效数字，可以在目标实现中选择启动时明确失败，但必须在实施报告中标记为有意的配置错误行为变化，并加入测试。

第一轮不得突然把当前可选配置改成必填。

### Dotenv 优先级

必须保持当前有效优先级：

```text
外部已有 process.env
→ .env.local
→ .env
→ 代码默认值
```

不得在配置重构时无意允许 `.env` 覆盖 `.env.local` 或外部进程环境。

### 不建立全局 Config Service

当前不引入：

```text
GlobalConfig
ConfigService.get()
RuntimeConfigRegistry
window.__APP_CONFIG__
ServiceLocator
```

浏览器第一轮使用普通只读配置对象和显式 Adapter 参数。

Server 第一轮使用普通只读配置对象、Capability 和显式依赖。

如果未来需要部署后动态浏览器配置，应单独提出 ADR，明确：

- 配置请求来源
- 启动阻塞
- 加载失败
- 缓存
- 版本
- Service Worker
- 安全边界
- HTML 注入方式

### Characterization Tests

实施前至少覆盖：

- 当前 MurmurLane API Base URL 回退。
- 当前开发与生产 WebChat URL 回退。
- Base URL 尾部 `/` 处理。
- 当前编辑 Token Header。
- 当前 WebChat 两种认证 Header。
- 当前 EventSource Token Query。
- 当前媒体 URL Token Query。
- 空白 Token 行为。
- 当前发送与上传 Timeout。
- `HAS_EDIT_TOKEN` 当前页面能力行为。
- `.env.local`、`.env` 与外部 `process.env` 的优先级。
- `API_HOST` 默认值。
- `PORT`、`API_PORT` 与默认端口的优先级。
- `CYBERBOSS_DATA_ROOT` 默认值和路径规范化。
- `API_FILE_MAX_BYTES` 默认值与非法值回退。
- 编辑 Token 为空时保持写入禁用。
- 配置对象与 Token 不进入 View Model。
- Server Secret 不进入 Browser Config。
- Fake Adapter 测试不需要修改全局环境变量。
- 配置在浏览器构建或 Server 启动后保持只读。

## Consequences

### Positive

- 浏览器公开信息与 Server-only Secret 的边界准确可见。
- Workspace、ContentSync 和领域纯逻辑不再隐式依赖构建环境。
- Adapter 和 Server 服务可以通过显式配置进行独立测试。
- 配置默认值、校验和生命周期有单一所有者。
- Server Secret 可以转换为窄安全能力，而不是作为完整配置扩散。

### Negative

- Composition Boundary 会增加少量解析和显式组装代码。
- 当前模块级常量需要通过兼容 Facade 渐进迁移。
- 配置改为启动快照后，运行中修改 `process.env` 不再即时生效。

### Risks

- 完整 `BrowserPublicConfig` 或 `ServerConfig` 可能被作为全局依赖传给所有模块。
- 浏览器可见 Token 可能继续被错误称为 Secret。
- 配置集中迁移可能无意改变现有默认值和 Dotenv 优先级。

这些风险通过最小 Adapter 配置、Server Capability、Characterization Tests 和行为保持型迁移来控制。

## Implementation constraints

第一轮只建立 Browser Config Parser、Server Config Parser 和最小 Adapter/Capability 注入 seam。

不得在本阶段：

- 修改认证协议
- 删除当前浏览器 Token
- 改变 Header 或 Query 参数
- 引入登录与会话系统
- 改变 API URL 默认值
- 改变发送或上传 Timeout
- 引入运行时全局 Config Service
- 向 View Model 传递 Token 或完整配置
- 让所有模块接收完整 AppConfig
- 把所有可选配置改为必填
- 修改 UI、CSS、DOM、滚动或动画
- 修改源码、环境变量、认证协议或构建流程
