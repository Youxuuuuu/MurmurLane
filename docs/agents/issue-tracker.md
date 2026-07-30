# 任务跟踪：共享本地 Markdown

Cyberboss 和 MurmurLane 共用同一个本地 Markdown 任务目录：

`D:\study\.cyberboss\engineering-tracker`

## 文件约定

- 每个功能使用一个目录：`<tracker>\<feature-slug>\`
- 需求说明位于：`<tracker>\<feature-slug>\spec.md`
- 实施任务位于：`<tracker>\<feature-slug>\issues\<NN>-<slug>.md`
- 每张任务必须包含 `Repo:` 字段，可选值为：
  - `cyberboss`
  - `murmurlane`
  - `both`
- 每张任务必须包含 `Status:` 字段，状态值见 `triage-labels.md`
- 讨论和进度记录追加在 `## Comments` 标题下

## 发布任务

当 skill 要求“发布到任务跟踪器”时，在共享目录中创建对应文件。不要在仓库内另外创建 `.scratch` 任务目录。

## 读取任务

根据用户提供的功能目录、任务编号或文件名，从共享目录读取任务。

## 归属不明

当一个症状尚不能判断属于 Cyberboss 还是 MurmurLane 时，先创建或更新任务为：

- `Repo: both`
- `Status: needs-triage`

随后按照 `docs/architecture/cross-repo-diagnosis.md` 收集最小证据，找到第一个出错的边界后再更新 `Repo:`。不要因为问题最先在浏览器里出现，就直接判定为 MurmurLane；也不要因为数据来自 Cyberboss，就直接判定为 Cyberboss。

## 项目范围

- `Repo: cyberboss`：Runtime、Channel、Conversation Archive 生产、WebChat 生产契约、消息投递或智能体桥接相关工作
- `Repo: murmurlane`：ContentSync、Workspace、View Model、展示、浏览器 Adapter、MurmurLane Server 读取与白名单编辑相关工作
- `Repo: both`：Conversation Record 字段、WebChat 事件、媒体结构、线程或消息命令、Runtime 状态等需要两个仓库协同完成的工作
