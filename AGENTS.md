# MurmurLane 仓库协作说明

## 项目角色

- MurmurLane 是 Cyberboss 持久内容的展示前端，同时提供实时 WebChat 交互。
- MurmurLane 可以通过自己的 Server 读取 Cyberboss Data Root，并只通过明确的白名单编辑日记、记忆、时间轴等内容。
- MurmurLane 不拥有 Runtime、Channel 路由或 Conversation Archive 的写入规则；这些由 Cyberboss 负责。

## 稳定所有权

- `src/app/config/` 负责解析浏览器公开配置，`src/app/composition/` 负责创建并组装具体浏览器 Adapter。
- `src/content-sync/` 负责来源读取有效性与文件变化同步机制，不得拥有 Workspace 业务解释。
- `server/` 负责本地数据访问、文件边界、白名单编辑和前端所需的服务端接口。
- `src/data/chatApi.ts` 负责消费 Cyberboss WebChat HTTP/SSE 契约。
- `src/workspaces/conversation/` 提供 Conversation Record 到 Transcript 展示语义的唯一公共 seam。
- `src/lib/conversation*.ts` 负责记录规范化、身份对账、排序和实时/归档合并。
- `src/components/conversation/ChatBubble.tsx` 是统一消息视觉语义的主要入口。
- 页面组件负责展示和交互，不应重新组合 Transcript 领域规则，也不应重新定义 Conversation 或 WebChat 契约。

## 数据与兼容性规则

- 不直接调用 Codex 或 ClaudeCode Runtime，不直接写 `conversations/*.jsonl`。
- Conversation 历史记录来自 Cyberboss Data Root；实时记录来自 WebChat。两者必须进入同一套合并和展示语义。
- 同语义的微信与 WebChat 消息应复用相同的 Conversation 规范化与气泡组件，避免按来源复制视觉分支。
- 临时 Live Record 被持久化 Canonical Record 替换时，应保持身份、顺序和首次展示行为稳定。
- 本地媒体可以从持久记录恢复时，优先通过 MurmurLane 的安全文件接口解析；不要无条件依赖 Cyberboss WebChat 服务在线。
- 修改 WebChat 类型、事件、请求字段、Conversation 字段、媒体结构或身份键时，必须同时检查 `D:\study\cyberboss` 的生产端。
- `VITE_*` 变量会进入浏览器构建产物，不得把新的服务端秘密当作 `VITE_*` 配置。

## 跨仓库工作

- 同时影响 Cyberboss 与 MurmurLane 的任务使用共享 tracker，并标记 `Repo: both`。
- 先确定数据或行为的所有者：Cyberboss 负责 Runtime、Channel 和标准记录；MurmurLane 负责消费、合并与展示。
- 不在 MurmurLane 复制 Cyberboss 的归档规范化实现；需要共享的契约应先在跨仓库任务中明确。
- Chat Gateway、共享契约包和统一 Conversation Store 仍是候选设计；在 ADR 确认前不得当作既定架构。

## 修改原则

- 保留现有视觉方向、滚动策略和交互细节；架构整理不等于 UI 重写。
- `App.tsx`、`ConversationPage.tsx` 和 `useWebChat.ts` 已承担较多协调职责。新增功能优先进入职责明确的模块，不继续堆入大型协调器。
- 提取代码时优先纯搬移和行为保持；不要同时改变数据流、视觉与动画。
- 媒体 URL 解析问题优先修复在数据或 URL resolution 层，不顺带改造展示组件。
- 新增语音、通话或媒体展示时，先复用统一 Conversation 语义，再增加专属交互。

## 验证

- 完整测试：`npm test`
- 类型与生产构建：`npm run build`
- WebChat、Conversation 或跨仓库契约变化还必须在 `D:\study\cyberboss` 运行：`npm run check` 与 `node --test`
- 视觉修改的构建通过不等于视觉验收；按用户要求决定是否进行浏览器或真机验证。

## Agent skills

### 任务跟踪

Cyberboss 和 MurmurLane 共用本地 Markdown 任务跟踪目录：`D:\study\.cyberboss\engineering-tracker`。具体规则见 `docs/agents/issue-tracker.md`。

### 任务状态

共享任务采用五种标准状态，具体映射见 `docs/agents/triage-labels.md`。

### 领域文档

本仓库采用单上下文领域文档布局。探索代码前先读取 `CONTEXT.md`，具体规则见 `docs/agents/domain.md`。
