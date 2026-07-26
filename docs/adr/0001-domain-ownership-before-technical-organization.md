---
Status: Accepted
Implementation: Partial
---

# 领域所有权优先于技术分类

MurmurLane 的功能状态、业务规则与交互流程归属于对应 Workspace；跨 Content Source 的数据生命周期，包括启动加载、缓存、文件 SSE、失效刷新、重连和全局同步状态，归属于统一 ContentSync；API、SSE Client、缓存工具、媒体解析和基础组件仅提供技术能力，不得拥有领域行为。新增代码时优先判断“这条规则由哪个领域拥有”，而不是先根据 React、API 或文件类型决定目录。

例如，线程删除由 Conversation Workspace 决定确认流程、请求时机、删除后的选中项、页面跳转和页面更新；ConversationListItem 只触发 `onDelete`，`chatApi.ts` 只负责发送请求。
