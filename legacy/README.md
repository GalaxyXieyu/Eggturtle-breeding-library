# Legacy 参考代码入口

本目录用于统一承接历史实现（Legacy）参考代码与迁移说明。

当前阶段采用“零破坏”策略：
- 真实代码仍位于仓库根目录 `backend/` 与 `frontend/`
- 运行脚本、Docker、CI 继续使用现有路径，避免联调中断

后续（在 refresh 鉴权能力补齐后）可执行目录收纳迁移：
1. `backend/ -> legacy/backend/`
2. `frontend/ -> legacy/frontend/`
3. 为兼容旧脚本，保留根目录软链或同步改写脚本路径

参考：
- `/backend`
- `/frontend`
- `docs/migration/COVERAGE.md`
