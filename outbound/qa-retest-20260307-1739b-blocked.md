# QA Re-test Blocked

- 时间: 2026-03-07 17:46 CST
- 目标: 服务刚重启后，复测白化显示、系列下拉/新建系列、默认黄色
- 结论: BLOCKED

## 已执行
1. 在仓库根目录执行 `./dev.sh status`，确认 API/Web/Admin 均未运行。
2. 按约定执行 `./dev.sh start`，失败。
3. 检查 `/tmp/eggturtle-api.log`，发现 `nohup: can't detach from console: Inappropriate ioctl for device`。
4. 改为直接执行 `pnpm --filter @eggturtle/api dev`，API 启动过程进一步暴露数据库阻塞。
5. 检查 API 启动报错，确认 Prisma 无法连接 `localhost:30001`。
6. 尝试执行 `docker compose -f docker-compose.local.yml up -d postgres minio`，失败，Docker daemon 不可用。

## 阻塞证据
- 仓库内报告: `outbound/qa-retest-20260307-1739b-blocked.md`
- API 日志: `/tmp/eggturtle-api.log`
- Web 日志: `/tmp/eggturtle-web.log`
- Admin 日志: `/tmp/eggturtle-admin.log`

## 关键错误
- `nohup: can't detach from console: Inappropriate ioctl for device`
- `PrismaClientInitializationError: Can't reach database server at localhost:30001`
- `Cannot connect to the Docker daemon at unix:///Users/apple/.docker/run/docker.sock`

## 对本轮 3 个检查项的影响
- 白化是否正常显示: 未复测，环境未起。
- 系列下拉/新建系列是否顺手: 未复测，环境未起。
- 默认黄色是否正常: 未复测，环境未起。

## 建议下一步
1. 先恢复 Docker daemon 或其他本地 Postgres 实例，让 `localhost:30001` 可连。
2. 若继续使用 `dev.sh`，需要在当前无交互终端环境兼容其 `nohup` 启动方式，或改用可持久后台进程方式拉起服务。
3. 服务恢复后，重新执行本轮 UI/UX 复测并补截图证据。
