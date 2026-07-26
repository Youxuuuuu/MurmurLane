---
Status: Accepted
Implementation: Partial
---

# 架构迁移先刻画行为并一次迁移一个 seam

架构迁移采用 Characterization Tests 先行、一次迁移一个 seam 的增量策略。每一步独立构建、验证、提交和回退，并保持当前可观察行为。任何有意行为变化必须单独实施、单独说明，不得伪装成架构重构。UI、CSS、DOM、滚动、窗口化和动画不得在行为保持型迁移中发生无意变化。

## 当前源码事实

`npm test` 当前只运行 `test/*.test.ts` 的 Node 测试。现有测试覆盖 Conversation Identity、Assistant Turn、历史窗口、Scroll Policy、媒体展示、Bubble Reveal、WebChat 上传、状态与发送事务等重要纯逻辑。

当前尚无正式的 ContentSync、Workspace Controller、App Navigation 和唯一 Transcript seam，因此没有相应的完整 seam 测试。`ConversationPage.tsx` 直接组合 Merge、隐藏规则、Display Identity、Assistant Turn、历史窗口、滚动策略和动画 Ledger；`useWebChat.ts` 同时管理具体 WebChat Adapter 调用、SSE Cursor、Live Records、线程创建迁移、发送事务、Usage 和连接状态；`App.tsx` 同时拥有远程数据加载、文件 SSE、缓存刷新和多个 Workspace 的协调状态；`server/index.ts` 同时负责启动、Express 路由、文件访问、缓存、编辑、媒体限制与静态托管。

因此，仅有 `npm test` 和 `npm run build` 通过，不能证明浏览器 DOM、Effect 时序、SSE 生命周期、滚动和 Framer Motion 行为完全未变。

## Characterization Tests

Characterization Test 记录当前已经被认可和依赖的行为，不宣称当前内部设计完美，只要求迁移前后对相同输入保持相同可观察结果。不得先迁移再根据新实现补一套只会证明新代码正确的测试。

每个 seam 的迁移过程是：

```text
确认并记录当前行为
→ 补充 Characterization Tests
→ 保存可回退基线
→ 迁移一个 seam
→ 运行相同测试
→ 运行类型检查与构建
→ 执行受影响范围的人工验收
→ 检查 Diff
→ 再进入下一个 seam
```

## 独立迁移单位

计划中的迁移单位包括 Conversation Transcript、App Composition Root 与最小 Adapter、ContentSync、Conversation Workspace Controller、App Navigation、搜索所有权、Server 分层和 `@ts-nocheck` 渐进移除。实施计划可以根据真实依赖小幅调整顺序，但不得在同一阶段并行迁移多个相互耦合 seam。

每个阶段必须可独立构建、测试、提交和回退，不依赖后续所有阶段完成后才可运行，不提前搬迁下一阶段职责，不夹带无关重命名、目录搬迁或格式化噪音，也不同时加入语音、通话、线程删除、Usage 等新功能。

## 各 seam 的刻画范围

Transcript seam 在迁移前锁定 Canonical 与 Live Records 合并、Canonical 替换 Live、Display 与 React Render Identity、Record 排序、隐藏规则、Operation 与图片、文件、Sticker 的分组和顺序、Assistant Turn 结构，以及同样输入产生同样 Transcript。第一轮复用当前真实 Fixture 和现有 Identity、Merge、Display Group 与 Assistant Turn 规则。

Composition Root 与 Adapter seam 保持 API URL、Query、Body、Header、Token、认证、超时、上传、媒体 URL、EventSource 参数、订阅与关闭、技术错误类型和 WebChat 返回值。第一轮只将现有 `api.ts`、`chatApi.ts` 包装到窄 Adapter 后面，不重写网络协议。

ContentSync 至少刻画启动加载与结果、文件 SSE 建立与释放、各 Content Source 的失效范围、Conversation、Timeline、Memory 和 Archive 刷新、重连重同步、错误与重试、旧请求不得覆盖新快照、事件去重和跨页面通知语义，并使用 Fake Data Adapter 而非真实网络。

Conversation Workspace 至少刻画当前线程与日期、WebChat 启用状态、草稿线程迁移、Live / Canonical 对账输入、未读、Profile、页面模式、发送成功、失败与不确定状态以及模型切换；删除命令尚不存在时不得提前虚构其行为。测试通过 Fake Adapter 与快照驱动，不启动真实 HTTP 或 EventSource。

App Navigation 至少刻画类型明确的导航意图、Workspace 激活、Target 只转交给目标 Workspace、调用方不修改目标内部状态、未知目标的应用级错误，以及 Conversation 目标仍由 Conversation Workspace 解释。

Server 在拆分前记录所有现有 URL、Query、Body、JSON 响应、HTTP 状态码、错误结构、CORS、编辑令牌、文件与媒体访问限制、SSE Header、事件格式与断开、静态托管、生产启动方式和缓存刷新语义。测试使用当前依赖下的最小方案，不提前规定特定测试框架。

## UI 与浏览器行为

Node 测试不能单独证明 DOM 是否重新挂载、React Key、Effect 时机、Composer 焦点、滚动与锚点恢复、历史窗口高度补偿、左滑与触摸手势、Framer Motion 动画重播或移动端输入行为。每个影响 View 生命周期的 seam 除纯逻辑测试外，还必须执行固定人工验收清单。是否增加组件测试或浏览器自动化，由实施阶段的真实风险决定；本 ADR 不要求立即引入大型 E2E 框架。

行为保持关注用户可观察行为和公开契约，不要求内部函数调用次数、文件位置或实现细节相同。它至少包括相同 Transcript、稳定 Live 到 Canonical 身份、Operation 与媒体顺序、线程创建迁移、页面导航、SSE 订阅重连刷新、API、Token、超时、上传、媒体 URL、Server 契约与安全边界、JSX、CSS、DOM、React Key、滚动、锚点、窗口化、动画时序和当前视觉交互。

## 有意行为变化

ADR-0004 的搜索所有权调整是明确业务语义变化，不属于纯行为保持型迁移，必须单独实施。唯一允许变化是 Conversation、Timeline 和 Archive 分别只搜索自己拥有的数据；搜索框的 JSX、样式、动画、输入、高亮、结果点击反馈和其他交互不得顺便改变。

其他未来有意行为变化同样遵守“单独 ADR 或 Tracker、单独提交、明确允许变化、独立验收”的流程，不得以顺便清理或架构需要为理由混入纯迁移提交。

## 提交与回退

每个 seam 使用独立提交或独立小型提交组。完成后报告迁移前 Characterization Tests、新增测试范围、修改文件、明确保留的行为、有意变化、自动测试、构建与类型检查、人工验收、已知未覆盖风险和提交 SHA。失败时只回退当前 seam，不要求撤销整个架构计划。
