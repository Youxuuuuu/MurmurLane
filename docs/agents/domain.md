# 领域文档

新会话或接手任务时，先使用 `AGENTS.md` 中的仓库协作说明建立基本边界。探索代码前，如果相关文件存在，应按任务需要读取以下文档：

1. `CONTEXT.md`：统一领域词汇。
2. `docs/architecture/current-architecture.md`：理解当前已经落地的架构和代码所有权。
3. `docs/adr/` 下相关 ADR：理解某个边界为什么这样决定。
4. `docs/architecture/migration-plan.md`：需要追溯迁移顺序、测试账本或历史阶段时再读。
5. `HANDOFF.md`：继续当前长任务或接手短期遗留事项时再读。
6. `docs/architecture/cross-repo-diagnosis.md`：问题归属可能在 MurmurLane 和 Cyberboss 之间时再读。

每个仓库采用独立的单上下文布局：

- `CONTEXT.md`：仓库的稳定领域词汇
- `docs/adr/`：架构决策记录

Cyberboss 和 MurmurLane 共用任务进度，但不共用领域文档。修改哪个仓库，就使用该仓库定义的领域词汇。

`CONTEXT.md` 只记录词汇，不记录目录结构、迁移计划、测试要求或阶段状态。当前架构事实写入 `docs/architecture/current-architecture.md`，决策理由写入 `docs/adr/`。

如果计划中的修改与现有 ADR 冲突，必须明确指出冲突，不得静默覆盖。

已完成实施的 ADR 仍然保留，作为后续判断所有权、依赖方向和行为边界的决策历史。只有决策本身变化、实施状态变化或发现描述与当前源码不一致时，才修改 ADR。

领域文档不存在时不视为错误，可以继续工作。后续在明确术语或设计决策时，再由领域建模相关 skills 创建。
