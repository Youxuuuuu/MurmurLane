---
Status: Accepted
Implementation: Complete
Date: 2026-07-31
---

# ADR-0020：Conversation Archive 删除在线委托 HTTP、离线委托 Cyberboss CLI

Conversation Archive 及其写入规则由 Cyberboss 拥有，MurmurLane 不得直接改写 `conversations/*.jsonl`；同时，用户要求在只运行 MurmurLane 页面与 MurmurLane Server、未运行 Cyberboss `shared:start` 时仍能快速删除对话。

Cyberboss 将提供唯一的线程归档删除模块，并由在线 HTTP 命令和轻量 `conversation:delete` CLI 共同调用。浏览器始终只向 MurmurLane Conversation Workspace 发出删除意图；MurmurLane Server 作为传输 Adapter，在 Cyberboss 在线时委托 HTTP 命令，在其未运行时按需调用 CLI，不启动 Runtime、Channel 或 WebChat，也不复制 JSONL、锁、删除状态或恢复规则。

两条入口必须共享相同的线程校验、文件锁、原子提交和删除结果契约。在线入口还必须拒绝删除正在运行或存在未完成发送事务的 Thread；CLI 仅用于 Cyberboss 主进程未运行的离线形态。只运行纯 Vite `npm run dev`、没有 MurmurLane Server 的形态不支持本地归档删除。

删除确认后应在 100 ms 内进入可见的处理中状态；以当前本地日期归档规模，在线 HTTP 与离线 CLI 均以 1 秒内完成、2 秒为正常上限。删除模块只扫描 Conversation 日期归档并原子重写包含目标 Thread 的文件，不扫描 Raw Session 或媒体目录；没有新的规模测量证据前，不为此引入数据库、全局持久索引或常驻后台服务。

## 已落地契约

- 浏览器调用 MurmurLane Server 的 `DELETE /api/conversations/thread/:threadId`，并继续复用 `MURMURLANE_EDIT_TOKEN`。
- MurmurLane Server 优先调用 Cyberboss 的 `DELETE /api/chat/thread/:threadId`；连接失败或目标端没有该路由时，才回退到相邻 Cyberboss 仓库的 `conversation:delete` CLI。冲突、鉴权失败和服务端错误不会被 CLI 回退掩盖。
- 在线探测使用 400 ms 超时，以便只启动 `npm run dev:all` 或 `npm run serve:prod` 时快速进入 CLI 路径。
- Cyberboss HTTP 与 CLI 共用 `ConversationWriter.deleteThreadRecords(...)`。删除状态写入 Conversation Archive 相邻的 `.conversation-deletion-state.json`，其中列表删除产生的 source key 单独记录为可恢复删除；普通 Writer 重放忽略它们，显式 `conversation:import` 会清除对应状态并恢复记录。
- 删除扫描只要求每个非空行是可解析的 JSON，并直接按原始 `threadId` 判断归属，不要求历史记录通过当前 Conversation Schema。目标线程的旧格式记录同样删除，其他线程的旧格式 JSON 原样保留；JSON 语法损坏、无法安全判断归属时仍在写入前整体中止。
- MurmurLane 的隐藏状态继续属于 Thread Profile，持久字段为 `listHidden` 与 `listHiddenThrough`；后者保存隐藏时最后一条稳定可见消息的身份，而不是时间戳。
