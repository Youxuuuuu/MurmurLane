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

**Voice Message**:
以异步 Conversation 媒体条目呈现、可以播放音频并可选择展示文字内容的消息。
_Avoid_: 实时语音通话、普通文字气泡的朗读状态

**Expandable Voice Bubble**:
Voice Message 的一体化折叠/展开容器；折叠态显示播放、波形、时长和操作，展开态在同一容器内追加 transcript，且不重挂载音频或改变消息身份。
_Avoid_: 独立 transcript 气泡、弹窗、展开时中断播放

**Decorative Voice Waveform**:
由固定高度数组绘制、统一用于新旧用户语音、Assistant 语音与 Speech Rendition 的可点击视觉进度轨道；形状不表达真实声学数据，但裁切进度与点击 seek 必须由真实音频时钟驱动。
_Avoid_: PCM peaks、随机波形、拖动 scrub、与真实播放时间脱节的进度

**Audio Playback Coordinator**:
协调当前页面 Voice Message、Speech Rendition 与 Voice Draft 的唯一活动音频；新播放暂停旧播放并保留旧进度，且不因展开、状态更新或 Live/Canonical 对账重置播放器。
_Avoid_: 多音频并发、自动恢复上一条、每个气泡各自争抢播放

**Voice Draft**:
用户完成录音后、显式发送前保留在 Composer 待选区和当前页面内存中的语音草稿；可以试听、删除或重录，离开时需要确认丢弃，尚不是 Voice Message，也不得上传或持久化。
_Avoid_: Voice Message、已上传附件、IndexedDB 草稿、松手即发送

**Voice Composer Flow**:
从切换语音输入、按住录制、上滑取消，到 Voice Draft 试听、删除、重录和显式发送的 Composer 交互流程；最终 UI 参考归档在共享 Tracker，正式页与开发 Preview 复用同一生产组件。
_Avoid_: 已发送 Voice Message 语音条、Speech Rendition、实时通话界面

**Voice Processing State**:
已发送用户语音在上传、转写、情绪分析、送达或失败阶段的领域状态；MurmurLane 用稳定图标槽、文字和无障碍名称呈现，但不自行推断后端进度。
_Avoid_: 播放进度、Assistant 正在输入、仅存在于 CSS 的状态

**Transcript Review**:
低置信度用户语音在提交 Runtime 前的人工复核状态；用户编辑 STT 文字、重试转写或删除消息，确认后产生 Normalized Voice Transcript。
_Avoid_: 音频编辑、已提交 transcript 的静默回写、Assistant transcript 展开

**Speech Rendition**:
既有 Assistant 文字消息的持久派生音频；文字气泡保持原语义，并在底部提供常驻轻量波形入口，供用户在气泡内展开或收起已保存音频的简易播放器。
_Avoid_: Voice Message、独立语音气泡、临时重复合成

**Voice Reply Policy**:
用户为当前 Thread 选择的 Assistant 回复媒介偏好，取值为文字优先、自适应或语音优先。
_Avoid_: 浏览器播放设置、TTS Provider、全局声音身份

**Assistant Voice Profile**:
由 Cyberboss 拥有、在所有 Thread 中保持一致的小机声音身份；MurmurLane 只展示或编辑其公开设置，不拥有 Provider 绑定与合成语义。
_Avoid_: Voice Reply Policy、按 Thread 音色、浏览器播放设置

**Speech Delivery Plan**:
Cyberboss 为单次 Assistant 语音生成的结构化表演信息；MurmurLane 只消费最终音频和必要展示状态，不解释或重写 Provider 参数。
_Avoid_: Voice Profile 编辑值、CSS 动画、朗读正文

**Consistent Keyboard Clearance**:
软键盘稳定打开后，Conversation 输入面与真实键盘顶边之间在受支持移动端环境中保持一致的可见垂直间距；该间距与输入面及其内置功能面板之间的标准呼吸间距相同。
_Implementation_: 优先使用系统通过 VirtualKeyboard API 暴露的真实键盘几何；Android 的 `resizes-visual` 浏览器无法提供该几何且已验证 VisualViewport 少报顶部遮挡时，使用统一的 16px 遮挡保护。
_Avoid_: 把未经验证的 Viewport 差值直接当作真实键盘边界、按机型维护补偿表、改写键盘关闭时的底部安全区

**Thread**:
由 Cyberboss 标识、在 MurmurLane 中选择和展示的一条持续对话。
_Avoid_: 页面路由、单个 Turn

**Runtime Context Snapshot**:
Cyberboss 为当前 Thread 提供的最近一次模型 API 调用活动上下文；可以因压缩、摘要或不同 Prompt 下降，并且当前不跨 Cyberboss 重启持久化。MurmurLane 只展示 Thread 匹配的 `contextUsage`，不从 Thread Usage Totals、Conversation Record 或浏览器状态回退估算。
_Display_: 收起态显示 `模型 · context 当前占用 / Runtime 实际窗口`；Context 小于 10k 显示完整整数，否则显示 k。ClaudeCode 的窗口是其实际采用的 200k 或显式 `[1m]` 的 1M；Codex 使用 Runtime 报告值。
_Avoid_: Thread 生命周期累计、账户配额、Provider 原生模型宣传上限、持久化的离线上次快照

**Thread Usage Totals**:
归属于单个 Thread、覆盖其全部 Turn 与模型切换的累计真实 Token 用量；页面刷新或 Runtime 重启不改变其累计边界。输入总量包含普通输入、缓存创建与缓存读取，缓存命中量只表示成功复用的缓存读取。
_Display_: 展开态显示累计输入、输出、缓存与 Token 加权命中率；累计值 `≤ 10m` 显示完整整数，`10m < x ≤ 10000m` 显示 k，`> 10000m` 显示 m。最下方 `最近 in / out / cache` 始终显示完整整数。
_Avoid_: 页面会话计数、单条消息用量、全局账户用量、Context 占用量

**Runtime Effort**:
由当前 Runtime 接受、用于表达后续 Turn 推理投入程度的等级；可选值以 Runtime 和当前模型真实声明的能力为边界。
_Avoid_: 模型质量等级、输出长度、Thinking 展示开关

**Conversation Archive Deletion**:
从 Conversation Archive 中移除某个 Thread 在删除切点之前已有的全部 Conversation Record，但保留其 Raw Session 来源、Thread Profile 和记录引用的媒体实体；切点之后的新记录保留并使 Thread 重新出现。普通重启、刷新和后台同步不会恢复旧记录，只有明确重新导入才会恢复。
_Avoid_: Raw Session Deletion、Runtime Thread Termination、Thread Profile Deletion、Media Deletion、自动重新投影、不可恢复销毁

**Thread List Hiding**:
从 Conversation 列表中隐藏某个 Thread，但保留其全部 Conversation Record、Thread Profile、搜索可达性和直接访问能力，并在共享 MurmurLane Data Root 中跨刷新、Server 重启和访问设备保持；隐藏边界由操作时已见的稳定消息身份确定。只有边界之后新产生且用户可见的 User 或 Assistant 内容会使其重新出现，历史重读、重新导入、对账和运行状态事件不会。
_Avoid_: Conversation Archive Deletion、Thread Profile Deletion、浏览器本地偏好、搜索过滤、访问禁用、读取即解除隐藏
