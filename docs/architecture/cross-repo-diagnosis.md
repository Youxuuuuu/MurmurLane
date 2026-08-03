# MurmurLane 与 Cyberboss 跨仓库问题诊断规范

## 文档目的

当问题最终显示在 MurmurLane 页面中，但尚不清楚根因属于 MurmurLane 还是 Cyberboss 时，使用本文档进行诊断、归属和任务拆分。

核心原则：

> 不根据症状出现的位置判断仓库。沿同一条数据或消息的稳定身份逐层检查，找到第一个违反已确认契约的 seam；该 seam 的所有者是主要修复仓库。

如果生产契约与消费实现都需要改变，任务归属为 `Repo: both`，并按照生产端先行、消费端随后更新的顺序执行。

相关文档：

- `CONTEXT.md`：Conversation、Live Record、Canonical Record 等稳定词汇。
- `docs/architecture/current-architecture.md`：当前系统所有权和依赖方向。
- `docs/agents/issue-tracker.md`：共享 Tracker 文件规范。
- `docs/agents/triage-labels.md`：标准任务状态。
- ADR-0008：Cyberboss 生产，MurmurLane 消费。
- ADR-0011：先建立 Characterization Test，再迁移或修复。
- ADR-0014：技术错误、领域结果与安全 View 状态。

## 不可靠的归属判断

以下现象不能单独证明问题属于哪个仓库：

```text
问题显示在网页上
→ 不等于 MurmurLane 生产了错误数据

刷新页面后恢复
→ 不等于只是前端缓存问题

HTTP 返回 accepted
→ 不等于 Runtime 已收到目标消息

Conversation JSONL 已出现记录
→ 不等于 Runtime 投递成功

两个仓库各自测试通过
→ 不等于真实跨仓库契约与事件时序正确
```

MurmurLane 是最终展示端，Cyberboss 的 Runtime、Channel、归档或 SSE 生产问题也会首先表现为页面异常。

## 归属判定

### Cyberboss 拥有

- Runtime 与 Channel。
- Thread 权威状态及 Runtime/Thread 对应关系。
- Canonical Conversation Record 的校验、生成和写入。
- Conversation Archive。
- WebChat HTTP/SSE 生产契约。
- 消息是否真正进入目标 Runtime。
- Runtime 工具结果如何变成标准媒体或 Conversation Record。

### MurmurLane 拥有

- Browser Adapter 的请求构造、响应校验和技术错误归一化。
- MurmurLane Server 的安全读取、白名单编辑和前端接口。
- ContentSync Snapshot、缓存、文件 SSE 和重同步。
- Workspace 领域状态、对账、搜索、未读、Mutation 和 Commands。
- Transcript、View Model。
- DOM、滚动、窗口化、动画、键盘和视觉展示。

### 两个仓库共同拥有

以下变化使用 `Repo: both`：

- Conversation Record 字段。
- WebChat Event 和命令。
- 媒体结构。
- Runtime 状态。
- Thread 或 Message 身份。
- Usage、语音、通话等跨仓库契约。

共同拥有不等于两边同时猜测实现。Cyberboss 先明确生产契约，MurmurLane 再更新消费映射和领域解释。

## 诊断前的 Tracker 状态

尚未定位时，不要强迫任务提前选择单仓库。

使用：

```text
Repo: both
Status: needs-triage
```

找到第一个错误 seam 后：

- 仅 Cyberboss 修改：改为 `Repo: cyberboss`。
- 仅 MurmurLane 修改：改为 `Repo: murmurlane`。
- 契约和消费端都要改变：保留 `Repo: both`。
- 两个仓库需要不同提交：拆成两个 Issue，并在 `## Comments` 标明先后关系。
- 缺少真实 Payload、日志或真机数据：改为 `Status: needs-info`。

共享 Tracker 位置：

[`murmurlane-stack/tracker`](../../../murmurlane-stack/tracker)

## 诊断第一步：建立反馈循环

在阅读大量源码或选择仓库前，先建立一个能捕获用户原始症状的反馈循环。

优先顺序：

1. 真实失败场景对应的自动测试。
2. HTTP/SSE 请求脚本。
3. 捕获并重放真实 Payload。
4. 最小运行时或 Adapter Harness。
5. 浏览器自动化。
6. 结构化人工复现与证据导出。

反馈循环必须：

- 能在修复前对用户的准确症状给出失败。
- 可重复，或显著提高偶发问题的复现率。
- 尽量缩短到秒级。
- 修复后可以使用同一流程确认通过。

如果无法建立反馈循环，应停止猜测，明确请求 HAR、SSE Payload、日志、录屏时间戳、真实设备数据或临时诊断权限。

## 稳定身份

跨仓库诊断不得只按消息文字或模糊时间查找。每次复现尽量记录同一组身份：

```text
incidentId
requestId
messageId
logicalTurnId
turnId
threadId
runtimeId
clientId
SSE cursor
Canonical Record id
sourceKey
发生时间与时区
```

不同事件不一定拥有全部字段，但已经存在的身份必须原样沿链路传递，不得在诊断记录中自行重建另一套身份。

## 实时 Conversation 诊断链

```text
1. MurmurLane View 发出 Command
2. Conversation Workspace 建立事务
3. WebChat Adapter 发送 HTTP
4. Cyberboss WebChat 接收并登记 requestId
5. Cyberboss 投递到目标 Runtime
6. Cyberboss 发布 WebChat SSE
7. MurmurLane Adapter 校验 SSE
8. Conversation Workspace 更新 Live State
9. Transcript 对账、分组和生成身份
10. View 渲染
```

逐层检查：

| 检查点 | 需要确认 | 所有者 |
| --- | --- | --- |
| Command | 用户意图、Thread、Message 身份是否正确 | MurmurLane |
| HTTP Request | URL、Body、Header、requestId 是否符合契约 | MurmurLane Adapter |
| WebChat Ingress | 是否接收并关联正确 Client/Thread | Cyberboss |
| Runtime Dispatch | runtimeId、threadId 和真实投递结果是否正确 | Cyberboss |
| SSE Production | Event Kind、Thread、Cursor、Record 是否完整 | Cyberboss |
| SSE Parsing | 正确事件是否被接受和归一化 | MurmurLane Adapter |
| Live State | 是否进入正确 Thread，旧 Cursor 是否被拒绝 | Conversation Workspace |
| Transcript | Canonical/Live 对账、媒体、顺序和身份是否正确 | Conversation Workspace |
| DOM | 样式、滚动、动画和挂载是否正确 | MurmurLane View |

## Canonical 内容诊断链

```text
1. Cyberboss 生成 Canonical Record
2. Cyberboss 写入 Conversation Archive
3. MurmurLane Server 读取文件
4. Browser Data Adapter 校验响应
5. ContentSync 发布 Snapshot
6. Workspace 解释 Snapshot
7. Transcript / View Model
8. View 渲染
```

判定示例：

- JSONL 已经错误：Cyberboss。
- JSONL 正确，MurmurLane Server 返回错误：MurmurLane Server。
- Server 响应正确，Adapter 拒绝合法契约：MurmurLane Adapter。
- Snapshot 缺失或过期结果覆盖：ContentSync。
- Snapshot 正确，领域结果错误：对应 Workspace。
- Transcript/View Model 正确，页面显示错误：View。

## “第一个错误 seam”判定法

从权威生产端向最终 View 顺序检查，不要从截图反向猜测。

例如附件刷新后才显示：

```text
刷新后的 Canonical 附件正确
→ Canonical Writer、Archive 和最终渲染大体可用

检查实时 SSE：
├─ 没有附件事件
│  → Cyberboss
├─ Event 发到错误 Thread
│  → Cyberboss
├─ Event 缺少 media/attachments
│  → Cyberboss
├─ Event 完整但 Browser Adapter 拒绝
│  → MurmurLane Adapter
├─ Adapter 输出正确但 Live State 缺失
│  → Conversation Workspace
├─ Transcript 条目错误
│  → Conversation Transcript
└─ Transcript 正确但样式错误
   → MurmurLane View
```

例如页面显示“发送成功”，但目标 Runtime 没收到：

```text
MurmurLane 收到 accepted
→ 检查 Cyberboss Request Ledger
→ 检查 runtimeId/threadId
→ 检查真实 sendTurn 结果

如果 Cyberboss 在目标 Runtime 确认前返回 accepted
→ Cyberboss

如果 Cyberboss 返回 failed/unknown，但 MurmurLane 显示 sent
→ MurmurLane Conversation Workspace
```

## 最小诊断证据包

每次跨仓库复现至少记录：

```text
问题描述
复现步骤
预期结果
实际结果
设备、浏览器、Runtime 和网络环境
发生时间与时区
稳定消息与线程身份
HTTP Request/Response 摘要
Cyberboss Ledger/Runtime 结果摘要
SSE Event 摘要
对应 Canonical Record 摘要
ContentSync Source/Revision
Live Record 是否存在
Transcript Item 是否存在
最终 DOM 表现
```

证据包不得包含：

- Token 或 Authorization Header。
- EventSource 认证 Query。
- 密码和 Server Secret。
- 无必要的绝对私人路径。
- 完整私人消息正文。
- 未筛选 Stack 或原始 Server Body。

正文和路径只保留定位所需的最小脱敏摘要。

## Hypothesis 与 Instrumentation

反馈循环建立后，列出 3～5 个可证伪假设。每个假设必须说明：

```text
如果 X 是原因
→ 在 Y seam 应观察到什么
→ 改变 Z 后结果应如何变化
```

Instrumentation 规则：

- 每个 Probe 只验证一个假设。
- 优先断点和结构化状态检查，其次使用目标明确的日志。
- 临时日志必须使用唯一前缀，例如 `[DEBUG-a4f2]`。
- 修复提交前删除全部临时日志。
- 不使用“记录所有内容再搜索”的方式泄露数据或制造噪音。

## Fixture 与契约测试

捕获真实 HTTP/SSE Payload 后，保存脱敏 Fixture，并在正确 seam 重放：

```text
Cyberboss 生产端测试
→ 证明会生成该契约

MurmurLane Adapter 测试
→ 证明可以校验和归一化该 Fixture

Workspace 测试
→ 证明事件进入正确领域状态

Transcript 测试
→ 证明输出正确展示语义和稳定身份
```

判定：

```text
Cyberboss Fixture 本身错误
→ Cyberboss

Fixture 正确，MurmurLane Replay 失败
→ MurmurLane

双方 Fixture 测试通过，真实运行失败
→ 重点检查身份关联、配置、订阅目标、事件时序和生命周期
```

当前不因诊断需要提前建立共享契约 Package。真实 Fixture、生产端权威定义和跨仓库契约测试足以形成第一阶段反馈循环。

## 可选的诊断能力

如果跨仓库问题频繁发生，可以单独设计一个默认关闭的 App Diagnostics/Instrumentation seam，导出脱敏诊断摘要：

```ts
{
  incidentId,
  navigation: {
    workspace,
    target,
  },
  conversation: {
    threadId,
    requestId,
    messageId,
    turnId,
    runtimeId,
  },
  webChat: {
    connectionStatus,
    cursor,
    lastEventKind,
    lastEventThreadId,
  },
  contentSync: {
    revision,
    sourceRevision,
    connectionStatus,
  },
  transcript: {
    canonicalCount,
    liveCount,
    displayItemCount,
    renderIds,
  },
}
```

该能力必须：

- 默认关闭。
- 不进入普通领域 View Model。
- 不改变业务状态。
- 不导出凭据、Server Secret、完整正文或私人路径。
- 使用现有稳定身份，不另造诊断身份体系。
- 作为独立功能经过 ADR/Tracker、测试和安全审查。

## 修复与提交

完成诊断后：

1. 将最小复现变成正确 seam 上的失败测试。
2. 只修改第一个错误 seam 的所有者。
3. 使用相同身份和原始复现再次验证。
4. 清理临时 Instrumentation。
5. 运行对应仓库完整验证。
6. 提交信息说明经过验证的根因，而不只描述表面症状。

如果涉及 WebChat、Conversation 或跨仓库契约：

```text
MurmurLane
→ npm test
→ npm run typecheck:strict
→ npm run typecheck:server
→ npm run build

Cyberboss
→ npm run check
→ node --test
```

必须区分：

- 定向测试通过。
- 完整测试通过。
- 已知基线失败。
- 仍待真实浏览器或真机验收。

不得使用部分信号宣称整个跨仓库问题已经解决。

## 禁止事项

- 不因问题出现在网页中就直接修改 MurmurLane。
- 不因刷新后恢复就直接添加轮询或定时刷新。
- 不在 MurmurLane 解析 Runtime 原始输出以绕过 Cyberboss 契约。
- 不在 Cyberboss 修复 MurmurLane 独有的 DOM、滚动、动画或键盘问题。
- 不同时修改两个仓库来试探哪个改动有效。
- 不在没有真实失败反馈循环时先提交“可能有用”的兜底。
- 不通过字符串匹配 Error Message 或工具提示文字决定领域行为。
- 不保留未标记的临时日志。
- 不在诊断资料中记录 Token、Secret 或完整私人内容。
- 不把定向测试通过描述成完整链路已经通过。

## 完成标准

跨仓库问题只有满足以下条件才能关闭：

- 原始用户症状可以稳定复现，或者已获得足够高的复现率。
- 已找到第一个错误 seam。
- 归属仓库有当前源码证据支持。
- 正确 seam 上存在回归测试，或明确记录当前缺少可测试 seam。
- 原始复现使用同一流程确认不再出现。
- 两个仓库的相关契约测试已执行。
- 临时 Instrumentation 已清理。
- 浏览器或真机问题已由对应环境验收。
- Tracker 的 `Repo:` 和 `Status:` 已更新。
