# 任务状态

| 标准角色 | 任务状态 | 含义 |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | 等待维护者判断和分类 |
| `needs-info` | `needs-info` | 等待补充信息 |
| `ready-for-agent` | `ready-for-agent` | 信息完整，可由智能体执行 |
| `ready-for-human` | `ready-for-human` | 需要人工处理 |
| `wontfix` | `wontfix` | 决定不处理 |

任务文件通过 `Status:` 字段记录当前状态。

## 使用约定

- `needs-triage`：默认用于尚未判断归属、优先级或修复路径的问题；跨仓库归属不明时配合 `Repo: both` 使用。
- `needs-info`：已经知道下一步需要哪些信息，但当前证据不足，例如缺少复现步骤、日志、截图、设备信息或数据样本。
- `ready-for-agent`：输入足够明确，智能体可以直接实施、验证并提交。
- `ready-for-human`：需要用户或维护者做产品判断、真机验收、授权操作、外部服务配置或其他人工步骤。
- `wontfix`：明确决定不处理；需要在任务评论中记录原因。

`Repo:` 表示任务归属，`Status:` 表示可执行状态。不要用 `Status:` 代替仓库归属判断。
