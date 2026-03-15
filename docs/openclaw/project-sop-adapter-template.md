# Project SOP Adapter Template

更新时间：YYYY-MM-DD

这份模板用于把统一的 OpenClaw / Codex / Review / QA SOP 注入到任何一个新项目。

使用原则：

- **共享 SOP 保持稳定**：跨项目通用的调度、任务、Review、QA、Feishu 镜像规则尽量不改。
- **项目只填 Adapter**：每个项目只补自己的路径、命令、角色、文档入口、风险边界。
- **先有盘点，再有自动化**：没有把入口、SSOT、Prompt、Skills 位置盘清楚前，不要急着做自动派发。

---

## 1. 项目身份

- 项目名：
- 仓库根目录：
- OpenClaw workspace 根目录：
- 主分支：
- 默认语言：
- 默认时区：

---

## 2. 当前 3 层结构

### 2.1 代码仓库

- 作用：
- 文档入口：
- 长期业务文档：
- 长期技术文档：
- UI / 设计文档：

### 2.2 OpenClaw workspace

- 作用：
- 任务板路径：
- 任务上下文目录：
- 队列文件：
- 运行态 state 文件：
- 主要编排脚本：

### 2.3 Feishu / 外部协作层

- 可见 tasklist：
- 文档沉淀位置：
- 截图回传方式：
- 是否只是镜像：是 / 否

---

## 3. SSOT 设计

### 3.1 任务板 SSOT

- 文件：
- 允许哪些字段：
- 推荐写入口：

### 3.2 运行态 SSOT

- 文件：
- 存哪些字段：
- 推荐写入口：

### 3.3 队列输入

- 文件：
- 是否允许自动补队：
- 是否允许人工直接编辑：

### 3.4 Feishu 镜像

- 同步策略：
- 写入口：
- ack / cursor 在哪：

---

## 4. 默认工作流

1. 需求评估：
2. 任务入池：
3. 判断是否可派发：
4. 派发给哪个 worker：
5. 开发中如何回写进度：
6. Code review 谁负责：
7. QA 谁负责、截图放哪里：
8. 谁来收口任务：
9. 谁负责 push / deploy：

---

## 5. Prompt / 指引位置

### 5.1 规则型 prompt

- repo `AGENTS.md`：
- workspace `AGENTS.md`：
- `PROJECT_GUIDE.md`：
- `WORKFLOW_AUTO.md`：

### 5.2 动态 prompt

- 哪个脚本拼派工 prompt：
- 是否带 `progress` 回写命令：是 / 否
- 是否带 Feishu task 信息：是 / 否

### 5.3 模板型 prompt

- 日报 / 周报模板：
- 任务上下文模板：
- 其他模板：

---

## 6. Skills 盘点

### 6.1 项目本地 skills

- 路径：
- 当前有哪些：

### 6.2 团队共享 skills

- 路径：
- 当前主链路必须技能：
- 当前辅助技能：

### 6.3 运行时安装技能

- 路径：
- 是否存在“定义位置”和“调用位置”分离：是 / 否
- 典型例子：

---

## 7. 必填命令

### 项目启动

```bash
# 例：
./dev.sh start
```

### 状态检查

```bash
# 例：
./dev.sh status
```

### 停止

```bash
# 例：
./dev.sh stop
```

### lint / build / test

```bash
# 例：
pnpm -r lint
pnpm -r build
```

### 任务运行态检查

```bash
python3 <workspace>/scripts/task_orchestrator.py status
```

### Feishu bridge 自检

```bash
python3 ~/.codex/skills/openclaw-lark-bridge/scripts/invoke_openclaw_tool.py \
  --tool feishu_task_tasklist \
  --action list
```

---

## 8. 当前风险与待优化

### P0

- 

### P1

- 

### P2

- 

---

## 9. 注入新项目时的最小落地包

一个新项目最少应准备：

1. repo `AGENTS.md`
2. workspace `AGENTS.md`
3. `PROJECT_GUIDE.md`
4. `playbooks/dev-workflow.md`
5. `tasks/README.md`
6. `tasks/context/TEMPLATE.md`
7. `task_orchestrator.py`
8. `taskboard.py`
9. 一份项目专用 inventory 文档
10. 一份可执行的 inventory 脚本

---

## 10. 建议的通用分层

建议把未来的 SOP 拆成 4 层：

1. **Core SOP（跨项目稳定）**
   - 单 worker / 任务 SSOT / review / QA / Feishu 镜像 / 收口纪律
2. **Project Adapter（每项目一份）**
   - 路径、命令、角色、文档入口、风险边界
3. **Runtime Inventory（自动盘点）**
   - 当前任务、会话、queue、skills、prompt 入口
4. **Automation Hooks（可选自动化）**
   - cron、日报、Feishu ack、deploy 通知
