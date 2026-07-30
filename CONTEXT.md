# MurmurLane 内容工作区上下文

MurmurLane 将 Cyberboss 的持久内容和 WebChat 实时对话组织为统一的人类可读工作区。这里定义项目讨论、代码和 ADR 中使用的稳定领域词汇；当前架构总览和实现边界见 `docs/architecture/current-architecture.md`。

## Language

### System Boundary

**MurmurLane**:
展示和编辑 Cyberboss 持久内容、并消费 WebChat 实时对话的用户界面系统。
_Avoid_: Cyberboss Runtime、Channel Adapter

**Cyberboss Data Root**:
MurmurLane 读取 Conversation、媒体、日记、记忆和时间轴等持久内容的授权根目录。
_Avoid_: MurmurLane 源码目录、任意本地文件系统

**Content Source**:
MurmurLane 中一类可浏览内容及其逻辑来源，例如 Conversation、Diary、Memory 或 Timeline。
_Avoid_: 任意文件路径、页面组件

**ContentSync**:
MurmurLane 中判断来源数据何时有效、何时刷新、以及当前同步状态是什么的应用级能力。
_Avoid_: Workspace Controller、全局业务控制器

**Content Snapshot**:
ContentSync 发布给 Workspace 的只读来源数据和同步元数据快照。
_Avoid_: Workspace 状态副本、View Model、可写 Store

**Editable Content**:
允许通过 MurmurLane Server 白名单流程修改的持久内容。
_Avoid_: Conversation Archive、Raw Session Record

### Workspace Language

**Workspace**:
MurmurLane 中拥有某一内容领域状态、业务规则、页面流程和用户意图解释的一块应用区域。
_Avoid_: React 页面组件、任意目录、共享工具层

**Workspace View Model**:
Workspace 从当前领域状态和来源快照推导出的页面渲染数据。
_Avoid_: API 响应、第二份 Store、React setter

**Workspace Command**:
View 交给 Workspace 的用户意图，例如选择线程、打开日期或发送消息。
_Avoid_: 底层 API 函数、React setter、DOM 操作

**App Navigation**:
MurmurLane 中激活目标 Workspace 并转交 Navigation Intent 的应用级导航能力。
_Avoid_: 目标 Workspace Controller、页面业务流程、DOM 定位器

**Navigation Intent**:
跨 Workspace 传递的类型明确目标意图，由 App Navigation 转交给目标 Workspace 解释。
_Avoid_: 直接调用其他 Workspace、页面路由字符串、DOM 定位命令

**Mutation Overlay**:
Workspace 在 Content Snapshot 之上持有的领域变更状态，用于表达尚未被新来源快照确认的用户写入结果。
_Avoid_: 性能缓存、Content Snapshot 修改、View 局部状态

### Conversation Language

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

**Conversation Transcript**:
由 Canonical Record 与 Live Record 对账后得到的 Conversation 可展示语义。
_Avoid_: Conversation Archive、手工维护的最终消息列表、DOM 窗口化状态

**Conversation View**:
把不同 Channel 和不同到达方式的 Conversation Record 统一呈现为同一套对话体验。
_Avoid_: WebChat 专用页面、微信专用页面

**Consistent Keyboard Clearance**:
软键盘稳定打开后，Conversation 输入面与真实键盘顶边之间在受支持移动端环境中保持一致的可见垂直间距；该间距与输入面及其内置功能面板之间的标准呼吸间距相同。
_Implementation_: 优先使用系统通过 VirtualKeyboard API 暴露的真实键盘几何；Android 的 `resizes-visual` 浏览器无法提供该几何且已验证 VisualViewport 少报顶部遮挡时，使用统一的 16px 遮挡保护。
_Avoid_: 把未经验证的 Viewport 差值直接当作真实键盘边界、按机型维护补偿表、改写键盘关闭时的底部安全区

**Thread**:
由 Cyberboss 标识、在 MurmurLane 中选择和展示的一条持续对话。
_Avoid_: 页面路由、单个 Turn

**Conversation Archive Deletion**:
从 Conversation Archive 中移除某个 Thread 在删除切点之前已有的全部 Conversation Record，但保留其 Raw Session 来源、Thread Profile 和记录引用的媒体实体；切点之后的新记录保留并使 Thread 重新出现。普通重启、刷新和后台同步不会恢复旧记录，只有明确重新导入才会恢复。
_Avoid_: Raw Session Deletion、Runtime Thread Termination、Thread Profile Deletion、Media Deletion、自动重新投影、不可恢复销毁

**Thread List Hiding**:
从 Conversation 列表中隐藏某个 Thread，但保留其全部 Conversation Record、Thread Profile、搜索可达性和直接访问能力，并在共享 MurmurLane Data Root 中跨刷新、Server 重启和访问设备保持；隐藏边界由操作时已见的稳定消息身份确定。只有边界之后新产生且用户可见的 User 或 Assistant 内容会使其重新出现，历史重读、重新导入、对账和运行状态事件不会。
_Avoid_: Conversation Archive Deletion、Thread Profile Deletion、浏览器本地偏好、搜索过滤、访问禁用、读取即解除隐藏
