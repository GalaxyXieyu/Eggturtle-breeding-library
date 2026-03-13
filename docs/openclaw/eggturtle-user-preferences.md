# Eggturtle 用户偏好与协作约定

- 先判断业务逻辑、字段含义、用户场景和边界，再决定是否开发，不轻易直接改代码。
- 任务 SSOT 以 `/Users/apple/coding/.openclaw/workspace/workspaces/groups/eggturtle/eggturtle/tasks/Tasks.csv` 为准，默认串行推进。
- 进度盘点、cron 提示词、任务审计统一从 workspace `Tasks.csv` 读取，不再以 `docs/plan/EggsTask.csv` 作为任务源。
- 代码完成后先做 code review，再做 `ui-ux-test`/QA，QA 未完成前不直接 `git push`。
- 本地启动/验收命令统一使用 `./dev.sh start`、`./dev.sh status`、`./dev.sh stop`。
- 若涉及账号验证，可优先读取仓库 `.env` 里的测试账号信息，不重复向用户追问。
