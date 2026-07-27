---
Status: Accepted
Implementation: Complete
ContentSync implementation: Complete
Workspace implementation: Complete
---

# 领域所有权优先于技术分类

## 当前实施结果

ContentSync 已拥有启动加载、Keyed Source Cache、Negative Cache、文件事件刷新、连接状态、Generation 与 Snapshot Revision。Conversation、Timeline 与 Archive Workspace 已拥有各自的选择、页面模式、Navigation Target、Mutation Overlay、命令状态和 View Model。

文件刷新后的 Canonical Conversation 批次只由 ContentSync 负责读取和发布；已见 Record 身份、首次同步基线、未读与通知资格已经迁入 Conversation Workspace。`App.tsx` 只组装 ContentSync、Navigation、Workspace 与 View，不再判断某条 Conversation Record 是否应产生未读或通知。

MurmurLane 的功能状态、业务规则与交互流程归属于对应 Workspace；跨 Content Source 的数据生命周期，包括启动加载、缓存、文件 SSE、失效刷新、重连和全局同步状态，归属于统一 ContentSync；API、SSE Client、缓存工具、媒体解析和基础组件仅提供技术能力，不得拥有领域行为。新增代码时优先判断“这条规则由哪个领域拥有”，而不是先根据 React、API 或文件类型决定目录。

例如，线程删除由 Conversation Workspace 决定确认流程、请求时机、删除后的选中项、页面跳转和页面更新；ConversationListItem 只触发 `onDelete`，`chatApi.ts` 只负责发送请求。
