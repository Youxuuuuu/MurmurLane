---
Status: Accepted
Implementation: Partial
---

# Workspace 通过导航意图协作

Workspace 之间只传递类型明确的导航意图，不读取、调用或修改彼此的内部状态。调用方只通过 `requestNavigation({ workspace, target })` 表达目标，不得直接调用目标 Workspace 的 controller、store、setter 或 DOM 定位逻辑。

App Navigation 只负责切换当前 Workspace、保存或转交类型明确的 navigation target，以及处理未知 Workspace 等应用级错误；它不判断 Conversation 的线程或日期是否合法，不决定数据加载、消息定位、高亮、删除、未读或搜索等领域行为。目标 Workspace 负责校验 target、加载所需数据、更新内部状态、定位内容，并决定滚动、高亮、失败提示和回退行为。

如果跨 Workspace 流程包含真正的业务编排，应建立显式 Application Flow，而不是让 Workspace 互相调用或把流程继续堆入 `App.tsx`。全局搜索结果跳转到 Conversation 仅用于说明导航 seam，不代表 Timeline、Archive 或回忆搜索拥有 Conversation 搜索能力。
