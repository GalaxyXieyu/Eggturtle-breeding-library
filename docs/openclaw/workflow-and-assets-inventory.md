# Eggturtle 任务工作流（唯一逻辑文档）

更新时间：2026-03-15

这份文档是当前 Eggturtle 项目里 **唯一需要长期维护的任务流程逻辑文档**。

它只讲 4 件事：

1. 用户应该看到什么动作
2. 系统内部应该自动做什么
3. 哪些文件/状态是主真相
4. 哪些 skills / 脚本分别承担什么角色

不再把内部 primitive、历史方案、实现细节拆成多份逻辑文档到处维护。

---

## 1. 核心原则

### 1.1 用户只表达意图

用户只应该感知这些动作：

- 创建任务
- 开始处理
- 更新进度
- 完成任务
- 查看状态
- 必要时重试同步

用户不应该承担系统内部编排步骤。

### 1.2 系统自己完成编排

系统内部可以拆很多 primitive，但这些只能是实现细节，例如：

- 本地任务入库
- 创建 Feishu task
- 回填 Feishu guid/url
- 绑定 ACP session
- 写 progress history
- 同步 Feishu comment / complete

这些都不该再成为用户心智模型。

### 1.3 本地 workspace 是控制面

当前控制面仍然是本地 workspace：

- `tasks/Tasks.csv`：任务板 SSOT
- `out/task-orchestrator/state.json`：运行态 SSOT
- `out/plan/AUTO_QUEUE.txt`：派发队列输入

Feishu 是镜像面，不是主库。

### 1.4 自动优先，手动只做兜底

正常流程应该自动完成：

- 创建任务 -> 自动镜像 Feishu
- progress -> 自动评论 Feishu
- complete -> 自动完成 Feishu task

只有在失败时，才允许走手动兜底，例如：

- `sync-task`
- `set-feishu-task`
- `feishu-sync-plan`

---

## 2. 用户可见的标准流程

## 2.1 创建任务

### 用户动作

用户只做一件事：

- 记录任务 / 记录 bug / 加需求 / 入池

### 系统自动动作

系统自动执行：

1. 写入 `Tasks.csv`
2. 创建 `tasks/context/Txx.md`
3. 加入 `AUTO_QUEUE.txt`
4. 自动查找或创建 Feishu tasklist `选育溯源档案`
5. 自动创建 Feishu task
6. 自动回填 `feishu_task_guid` / `feishu_task_url`
7. 若失败则记录为可重试失败

### 用户应看到的结果

应该只看到两种结果之一：

- `已创建 Txx，并已同步飞书。`
- `已创建 Txx；飞书同步失败，已进入待重试。`

而不是再额外要求用户手动执行“再同步一次”。

---

## 2.2 开始处理

### 用户动作

用户只表达：

- 开始让 Codex 做
- 继续做当前任务

### 系统自动动作

系统自动执行：

1. 判断当前 worker 是否空闲
2. 读取任务队列
3. 选择下一条任务
4. 派发 ACP Codex
5. 绑定 `child_session_key`
6. 更新任务状态为 `doing`

---

## 2.3 更新进度

### 用户动作

用户只表达：

- 看进度
- 记一条进度
- 记录当前做到哪里

### 系统自动动作

系统自动执行：

1. 写本地 `history`
2. 更新 `Tasks.csv` 的摘要 evidence
3. 若已建立 Feishu 任务映射，则自动写 comment
4. 如果 comment 失败，则记成可重试镜像失败

---

## 2.4 完成任务

### 用户动作

用户只表达：

- 完成任务
- 收口

### 系统自动动作

系统自动执行：

1. 本地任务状态改为 `done`
2. 写入完成证据
3. 自动完成 Feishu task
4. 清理 queue / active binding
5. 判断是否自动派发下一条

---

## 2.5 重试同步

### 用户动作

用户只在失败时表达：

- 重试同步
- 补同步飞书

### 系统动作

系统自动执行：

1. 查找本地已有任务但缺少 Feishu 映射的条目
2. 创建 Feishu task 或补全绑定
3. 回填 `guid/url`
4. 恢复镜像状态为 `ok`

这个动作只应该是兜底，不应该成为日常主流程。

---

## 3. 内部 primitive（保留，但不对用户暴露）

这些命令和步骤仍然保留，但定位已经降为 **内部实现 / 调试 / 运维兜底**。

### 3.1 任务 primitive

- `add-task`
- `add-bug`
- `sync-task`
- `set-feishu-task`
- `feishu-sync-plan`
- `feishu-sync-ack`

### 3.2 会话 primitive

- `next`
- `bind-session`
- `complete-session`
- `cleanup-session`

### 3.3 Feishu primitive

- `feishu_task_task.create`
- `feishu_task_comment.create`
- `feishu_task_task.patch`
- `feishu_task_tasklist.list/create`

### 3.4 一条硬规则

> primitive 可以存在，但不能再成为主流程的用户操作步骤。

---

## 4. 当前主真相（SSOT）

### 4.1 任务板 SSOT

- `/Users/apple/coding/.openclaw/workspace/workspaces/groups/eggturtle-lab/eggturtle-lab/tasks/Tasks.csv`

用途：

- 任务列表
- 任务状态
- 执行者
- 证据摘要

### 4.2 运行态 SSOT

- `/Users/apple/coding/.openclaw/workspace/workspaces/groups/eggturtle-lab/eggturtle-lab/out/task-orchestrator/state.json`

用途：

- 当前活跃任务
- session 绑定
- Feishu 任务映射
- progress / complete history
- 镜像同步游标

### 4.3 队列输入

- `/Users/apple/coding/.openclaw/workspace/workspaces/groups/eggturtle-lab/eggturtle-lab/out/plan/AUTO_QUEUE.txt`

用途：

- 当前任务派发顺序

### 4.4 单任务上下文

- `/Users/apple/coding/.openclaw/workspace/workspaces/groups/eggturtle-lab/eggturtle-lab/tasks/context/Txx.md`

用途：

- 任务背景
- 当前口径
- 验收目标
- 交接上下文

---

## 5. 现在真正生效的代码入口

### 5.1 主编排器

- `/Users/apple/coding/.openclaw/workspace/workspaces/groups/eggturtle-lab/eggturtle-lab/scripts/task_orchestrator.py`

它现在承担：

- 本地入库
- 自动创建 Feishu tasklist / task
- 自动回填 guid/url
- progress 自动 comment
- complete 自动 patch 完成态
- 保留 fallback 同步计划

### 5.2 任务板写入口

- `/Users/apple/coding/.openclaw/workspace/workspaces/groups/eggturtle-lab/eggturtle-lab/scripts/taskboard.py`

它只负责稳定维护 `Tasks.csv`。

### 5.3 OpenClaw Feishu bridge

- `~/.codex/skills/openclaw-lark-bridge/scripts/invoke_openclaw_tool.py`

它是当前自动镜像 Feishu 的实际调用入口。

---

## 6. skills 角色分工

用户不应该先记 skill 名字，但系统内部仍然需要明确分工。

### 6.1 任务控制

- `eggturtle-task-orchestrator`

负责：

- 入池
- 排队
- 单 worker 调度
- 收口

### 6.2 编码 worker

- `acp-codex-orchestrator`

负责：

- spawn ACP Codex
- 继续已有 ACP 会话
- 查询进度
- 停止会话

### 6.3 Feishu 镜像

- `openclaw-lark-bridge`

负责：

- 创建 / 查询 / 更新 Feishu task
- 创建 comment
- 未来扩展到文档 / drive / wiki

### 6.4 Code review

- `code-review`

负责：

- 代码质量检查
- 变更风险分级

### 6.5 QA / 验收

- `ui-ux-test`

负责：

- 截图验收
- 回传路径
- 生成报告

---

## 7. 状态模型

## 7.1 用户可见任务状态

只保留：

- `todo`
- `doing`
- `blocked`
- `done`

## 7.2 镜像状态

单独维护，不混进任务状态：

- `ok`
- `pending`
- `failed_retryable`

含义：

- `ok`：本地与 Feishu 映射已建立，自动镜像正常
- `pending`：刚创建 / 尚未完成镜像，或等待后续同步
- `failed_retryable`：自动镜像失败，可执行 `sync-task` 重试

---

## 8. 当前推荐命令面

## 8.1 正常主流程

### 创建任务

```bash
python3 /Users/apple/coding/.openclaw/workspace/workspaces/groups/eggturtle-lab/eggturtle-lab/scripts/task_orchestrator.py add-task \
  --summary "一句话任务标题" \
  --description "上下文 / 目标 / 预期结果"
```

现在默认会自动尝试同步 Feishu。

### 查看状态

```bash
python3 /Users/apple/coding/.openclaw/workspace/workspaces/groups/eggturtle-lab/eggturtle-lab/scripts/task_orchestrator.py status
```

### 开始 / 继续派发

```bash
python3 /Users/apple/coding/.openclaw/workspace/workspaces/groups/eggturtle-lab/eggturtle-lab/scripts/task_orchestrator.py next
```

### 更新进度

```bash
python3 /Users/apple/coding/.openclaw/workspace/workspaces/groups/eggturtle-lab/eggturtle-lab/scripts/task_orchestrator.py progress \
  --task-id Txx \
  --status doing \
  --note "当前做到哪一步"
```

现在默认会自动尝试 comment 到 Feishu。

### 完成收口

```bash
python3 /Users/apple/coding/.openclaw/workspace/workspaces/groups/eggturtle-lab/eggturtle-lab/scripts/task_orchestrator.py complete-session \
  --child-session-key agent:codex:acp:...
```

现在默认会自动尝试完成 Feishu task。

## 8.2 失败兜底

### 重试某条任务的 Feishu 镜像

```bash
python3 /Users/apple/coding/.openclaw/workspace/workspaces/groups/eggturtle-lab/eggturtle-lab/scripts/task_orchestrator.py sync-task --task-id Txx
```

### 手动回填绑定（极少数运维修复场景）

```bash
python3 /Users/apple/coding/.openclaw/workspace/workspaces/groups/eggturtle-lab/eggturtle-lab/scripts/task_orchestrator.py set-feishu-task \
  --task-id Txx \
  --feishu-task-guid <guid> \
  --feishu-task-url <url>
```

### 生成 fallback 同步计划（仅在自动镜像失效时使用）

```bash
python3 /Users/apple/coding/.openclaw/workspace/workspaces/groups/eggturtle-lab/eggturtle-lab/scripts/task_orchestrator.py feishu-sync-plan
```

---

## 9. 文档治理规则

### 9.1 只维护这一份逻辑文档

从现在开始，任务流程逻辑只维护这一个文件：

- `docs/openclaw/workflow-and-assets-inventory.md`

### 9.2 其他文档的定位

以下文档只保留为支持文档，不再维护完整流程逻辑：

- `docs/openclaw/openclaw-daily-summary.md`
  - 只讲日报 cron
- `docs/openclaw/project-sop-adapter-template.md`
  - 只讲新项目怎么填 adapter
- `docs/openclaw/low-cognitive-load-sop-refactor.md`
  - 只保留为归档说明 / 过渡说明
- workspace 内旧的 `docs/openclaw/workflow-acp-openclaw.md`
  - 改为指向本文件，不再单独维护

### 9.3 修改任务流程时怎么做

以后任何任务流程相关改动，按这个顺序：

1. 先改 `task_orchestrator.py` / 相关编排代码
2. 再只更新这一个逻辑文档
3. 最后视情况更新模板或支持文档

不要再把同一套流程拆到多份逻辑文档里分别维护。

---

## 10. 面向未来跨项目注入的做法

如果未来想把这套 SOP 注入任何项目，不应该直接复制 Eggturtle 的路径和脚本细节。

应该复用的是：

- 用户只看意图动作
- 系统内部保留 primitive
- 本地 SSOT + 外部镜像
- 自动优先，手动只做兜底
- `review -> QA -> push` 固定链路

Eggturtle 当前项目特有的内容，应该只放在 adapter 模板里，而不再混到核心逻辑里。

---

## 11. 一句话总结

这套流程现在的目标形态是：

> **用户只做“创建 / 开始 / 更新 / 完成 / 查看 / 重试”这些动作；系统内部自己完成本地入库、Feishu 镜像、会话绑定、收口和兜底。**

如果未来再看到用户需要记住 `add-task -> create feishu task -> set-feishu-task` 这样的链路，就说明流程又退化了，需要继续收口。
