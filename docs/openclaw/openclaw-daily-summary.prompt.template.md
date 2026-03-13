你当前在执行 Eggturtle 的 OpenClaw 定时日报任务。请严格执行下面步骤，并且不要虚构任何成功结果。

1. 进入仓库 `{{repo_root}}`。
2. 运行：`python3 scripts/openclaw_daily_summary.py --date today --timezone {{timezone}} --output-dir {{output_dir}} --stdout`
3. 阅读脚本生成的 markdown/json，本地文件应落在 `{{output_dir}}` 下。
4. 基于生成结果整理一条 6-10 行的群摘要，必须包含：
   - 今天开发了什么
   - 当前存在什么问题或阻塞
   - 用户偏好 / 协作约定摘要
5. 优先使用当前 ACP Codex / OpenClaw 会话里可用的 Feishu MCP 或飞书集成完成同步：
   - 群 chat_id：`{{chat_id}}`
   - 飞书文件夹 token：`{{folder_token}}`
   - 飞书文档 token：`{{doc_token}}`
6. 如果飞书文件夹 token 未配置，但工具可用，请先尝试创建一个名为 `Eggturtle 日报周报` 的文件夹，再在其下创建/更新当日日报文档。
7. 如果群 chat_id 已配置，则把群摘要发到该群；如果 doc/folder 可用，则把完整 markdown 同步到飞书文档。
8. 无论成功还是失败，都把真实执行结果写回：
   - `{{output_dir}}/latest.run-result.md`
   - `{{output_dir}}/latest.run-result.json`
9. 如遇到权限不足、gateway 不在线、MCP 超时、工具缺失等情况，必须原样记录真实报错，不允许编造“已创建”“已同步成功”。

当前 cron agent：`{{agent_id}}`
