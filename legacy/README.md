# Legacy 参考代码入口

本目录用于承接历史实现（Legacy）参考代码。

当前状态（2026-03-01）：
- Legacy 代码已经迁移到本目录：
  - `legacy/backend`
  - `legacy/frontend`
- Legacy 不作为当前运行主线。
- 默认开发、联调、部署请使用根目录 `apps/*` 与 `packages/*`。

使用原则：
- 仅在历史行为对照、迁移排查时查阅 Legacy。
- 不在主文档中把 Legacy 接口当成当前接口能力。
