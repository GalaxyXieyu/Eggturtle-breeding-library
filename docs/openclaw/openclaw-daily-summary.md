# OpenClaw 每日 22:30 日报落地方案

## 目标

- 每天 22:30 自动生成 Eggturtle 日报。
- 日报内容至少包含：开发了什么、存在什么问题、用户偏好 / 协作约定。
- 优先通过 ACP Codex / OpenClaw 的 Feishu 集成把结果发群并同步到飞书文档。
- 飞书失败时，保留本地 markdown/json，并把真实错误写回结果文件。

## 现状盘点

- 仓库 API 已启用 `@nestjs/schedule`，存在 `apps/api/src/payments/subscription-order-scheduler.service.ts` 作为现有 cron 参考。
- 仓库内没有现成的飞书日报/周报自动化脚本，也没有直连飞书的环境变量配置。
- OpenClaw 本机已安装，`openclaw cron`、`openclaw channels`、`openclaw message send` 可用。
- OpenClaw 本机状态显示 Feishu channel 已配置，但 `openclaw channels status --probe` 返回 gateway 不在线：`ws://127.0.0.1:18789` 超时。
- 当前仓库任务 SSOT 是 `/Users/apple/coding/.openclaw/workspace/workspaces/groups/eggturtle/eggturtle/tasks/Tasks.csv`。

## 本次新增内容

- `scripts/openclaw_daily_summary.py`
  - 从 git、workspace `Tasks.csv`、`docs/openclaw/eggturtle-user-preferences.md` 生成日报。
  - 默认把结果写到 `out/openclaw-reports/daily/YYYY-MM-DD.md` 与 `.json`。
  - 可选尝试通过 `openclaw message send --channel feishu` 发群，并原样记录失败信息。
- `scripts/register_openclaw_daily_summary.sh`
  - 读取 `.env.openclaw-daily-summary` 或环境变量。
  - 预览或注册一个 `22:30 Asia/Shanghai` 的 OpenClaw cron job。
  - cron job 采用 isolated session，默认 agent 为 `eggturtle-codex`，并要求任务执行时优先使用 Feishu 集成。
- `docs/openclaw/openclaw-daily-summary.prompt.template.md`
  - 统一约束 cron agent 的执行步骤、结果文件与报错保真要求。
- `docs/openclaw/eggturtle-user-preferences.md`
  - 固化用户偏好与协作约定，供日报脚本读取。
- `docs/openclaw/openclaw-daily-summary.env.example`
  - 提供 chat_id、folder token、doc token 等配置位。

## 运行方式

### 1. 本地先生成一份日报

```bash
python3 scripts/openclaw_daily_summary.py --date yesterday --timezone Asia/Shanghai --stdout
```

### 2. 预览 OpenClaw cron 注册内容

```bash
cp docs/openclaw/openclaw-daily-summary.env.example .env.openclaw-daily-summary
./scripts/register_openclaw_daily_summary.sh
```

### 3. 确认配置后正式注册

```bash
./scripts/register_openclaw_daily_summary.sh --apply
```

## 推荐配置

- `OPENCLAW_FEISHU_CHAT_ID`
  - 配置需要接收日报的飞书群 `chat_id`。
- `OPENCLAW_FEISHU_FOLDER_TOKEN`
  - 如果已手工创建“日报周报”文件夹，填入其 token，cron agent 会优先往这个文件夹里写日报文档。
- `OPENCLAW_FEISHU_DOC_TOKEN`
  - 如果已有固定日报文档，也可直接填固定文档 token。

## 当前已知限制

- 通过当前 ACP Codex 会话调用 Feishu MCP 创建文件夹/文档时，连续出现 `timed out awaiting tools/call after 120s`。
- 当前 OpenClaw gateway 未在线，因此真正的群发/cron 执行还依赖后续启动 gateway。
- 仓库内暂未实现“自动周报”生成；已预留 `out/openclaw-reports/weekly/` 本地目录，后续可在同一脚本上扩展。
