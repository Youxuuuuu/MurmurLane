---
Status: Accepted
Implementation: Complete
---

# Express 仅作为 Server 传输 Adapter

## 实施结果

`server/index.ts` 现在只加载配置、创建生产依赖、监听端口并处理进程信号；`server/app.ts` 只创建 Express 并组装路由依赖。HTTP 参数、状态码、CORS、SSE 格式、静态托管和错误映射集中在 `server/routes.ts`。

Conversation 读取、Content Read Model 与缓存、Memory、Media、Reminder、Live Update、文件边界、白名单编辑和 Conversation Profile 已进入不依赖 Express 的模块。Live Update Service 只发布普通变化事件，由 Router 转换成 SSE。Server Access 使用启动期 Data Root 快照并集中执行路径边界；Conversation 仍只有读取能力，没有新增 Archive 写入或删除路径。

Express 仅作为 MurmurLane Server 的传输 Adapter。`server/index.ts` 只负责读取和校验运行环境、创建生产依赖、调用 `createApp()`、启动监听与日志，以及进程信号和优雅关闭；不得包含 Conversation 查询、目录遍历、JSONL 或 Markdown 解析、缓存实现、文件编辑规则或 HTTP 路由实现。

`server/app.ts` 负责创建 Express App、公共中间件、CORS、Body 解析、访问控制中间件、挂载领域 Router、统一 HTTP 错误映射和静态前端托管，并导出 `createApp(dependencies): Express`。导入 `app.ts` 不得自动监听端口。

Router / HTTP Adapter 负责路径、Query 和 Body 参数解析、输入校验、调用领域接口、将领域结果或错误映射成既有 HTTP 状态码和响应结构，以及 SSE 等传输协议格式。Router 不遍历数据目录、不读取或解析 JSONL、不维护领域缓存、不修改数据文件、不复制安全路径规则，也不拥有 Timeline、Memory 或 Conversation 业务规则。

领域模块接收普通输入并返回明确结果，不依赖 Express 的 `Request`、`Response` 或 `NextFunction`。模块按当前真实职责形成，例如 Conversation Read Model、Timeline Service、Memory Service、Media Service 和 Live Update Service；具体文件名依据现有代码调整，不以平均拆分行数为目标，也不引入没有真实使用方的通用 Repository 或全局依赖注入框架。

MurmurLane Server 的 Conversation 模块只读取 Cyberboss 产生的 Conversation Archive，不得直接写入、改写或删除 `conversations/*.jsonl`。线程删除、消息删除或其他 Conversation 写操作必须通过 Cyberboss 的正式命令接口执行。Timeline 与 Memory 写入继续服从现有白名单编辑边界，拆分不得扩大可编辑文件、字段、路径范围或编辑令牌权限。

Data Root、路径安全、编辑令牌、媒体类型与文件限制应形成明确且可复用的 Server Access 能力，只抽取现有真实规则，避免 Router 复制实现，不建立通用存储框架。领域模块返回或抛出 `NotFound`、`InvalidInput`、`AccessDenied`、`Conflict` 等明确领域错误，由 Router 映射为 HTTP 状态码；领域模块不返回 Express Response，也不以 HTTP 状态码作为核心契约。

文件监听与 SSE 传输遵守同一边界：Live Update Service 发布普通变化事件，SSE Router / Adapter 将事件转换为 SSE 协议；监听服务不直接管理 Express Response。

实施前先为现有 Server 接口补充 Characterization Tests。第一轮是行为保持型重构，必须保持所有现有 URL、Query、Body、JSON 响应、HTTP 状态码、CORS、静态托管、生产启动方式、文件 SSE、缓存语义、编辑权限以及文件和媒体安全限制。
