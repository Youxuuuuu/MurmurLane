# MurmurLane 展示与实时对话上下文

MurmurLane 将 Cyberboss 的持久内容和实时对话组织为统一的人类可读界面。这里定义归档记录、实时记录与展示身份之间的统一词汇。

## Language

**MurmurLane**:
展示和编辑 Cyberboss 持久内容、并消费 WebChat 实时对话的用户界面系统。
_Avoid_: Cyberboss Runtime、Channel Adapter

**Cyberboss Data Root**:
MurmurLane 读取 Conversation、媒体、日记、记忆和时间轴等持久内容的授权根目录。
_Avoid_: MurmurLane 源码目录、任意本地文件系统

**Conversation Record**:
由 Cyberboss 生成、供 MurmurLane 展示和检索的标准对话记录。
_Avoid_: React 组件状态、原始 Runtime 日志

**Archived Record**:
已经存在于 Conversation Archive 中、可在 Cyberboss 不运行时读取的 Conversation Record。
_Avoid_: Live Record、Mock 数据

**Live Record**:
通过 WebChat 实时到达、尚未由对应 Archived Record 确认的临时 Conversation Record。
_Avoid_: Archived Record、乐观输入草稿

**Canonical Record**:
用于最终替换对应 Live Record 的持久化 Conversation Record。
_Avoid_: 临时 SSE 事件、重复副本

**Reconciliation**:
把语义相同的 Live Record 与 Canonical Record 识别为同一条消息，并保留稳定展示身份的过程。
_Avoid_: 简单数组拼接、仅按时间排序

**Display Identity**:
MurmurLane 用于保持气泡节点、动画和交互连续性的稳定消息身份。
_Avoid_: 数据库主键、数组下标

**Conversation View**:
把不同 Channel 和不同到达方式的 Conversation Record 统一呈现为同一套对话体验。
_Avoid_: WebChat 专用页面、微信专用页面

**Thread**:
由 Cyberboss 标识、在 MurmurLane 中选择和展示的一条持续对话。
_Avoid_: 页面路由、单个 Turn

**Content Source**:
MurmurLane 中一类可浏览内容及其逻辑来源，例如 Conversation、Diary、Memory 或 Timeline。
_Avoid_: 任意文件路径、页面组件

**Editable Content**:
允许通过 MurmurLane Server 白名单流程修改的持久内容。
_Avoid_: Conversation Archive、Raw Session Record
