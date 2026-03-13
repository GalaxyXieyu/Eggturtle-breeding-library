#!/usr/bin/env python3
"""Generate a daily Eggturtle summary for OpenClaw cron jobs."""

from __future__ import annotations

import argparse
import csv
import json
import subprocess
import sys
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Iterable
from zoneinfo import ZoneInfo


DEFAULT_TIMEZONE = 'Asia/Shanghai'
DEFAULT_TASKS_CSV = Path('/Users/apple/coding/.openclaw/workspace/workspaces/groups/eggturtle/eggturtle/tasks/Tasks.csv')
DEFAULT_PREFERENCES_FILE = Path('docs/openclaw/eggturtle-user-preferences.md')
DEFAULT_OUTPUT_DIR = Path('out/openclaw-reports/daily')


@dataclass
class TaskRow:
    task_id: str
    task: str
    executor: str
    status: str
    evidence: str
    blocker: str
    order: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Generate a daily report for Eggturtle OpenClaw automation.')
    parser.add_argument('--date', default='today', help='Report date: YYYY-MM-DD, today, or yesterday')
    parser.add_argument('--timezone', default=DEFAULT_TIMEZONE, help='IANA timezone name')
    parser.add_argument('--repo-root', default='.', help='Repository root path')
    parser.add_argument('--tasks-csv', default=str(DEFAULT_TASKS_CSV), help='Workspace Tasks.csv path')
    parser.add_argument(
        '--preferences-file',
        default=str(DEFAULT_PREFERENCES_FILE),
        help='Markdown file that stores user preferences and collaboration rules'
    )
    parser.add_argument('--output-dir', default=str(DEFAULT_OUTPUT_DIR), help='Directory for markdown/json outputs')
    parser.add_argument('--stdout', action='store_true', help='Print markdown report to stdout')
    parser.add_argument('--send-feishu', action='store_true', help='Attempt Feishu group delivery via openclaw message send')
    parser.add_argument('--feishu-chat-id', default='', help='Feishu chat_id for openclaw message send')
    parser.add_argument('--message-title', default='Eggturtle 日报', help='Title used for chat delivery')
    return parser.parse_args()


def resolve_report_date(raw_value: str, timezone_name: str) -> tuple[date, datetime, datetime]:
    timezone = ZoneInfo(timezone_name)
    now = datetime.now(timezone)
    normalized = raw_value.strip().lower()
    if normalized == 'today':
        report_date = now.date()
    elif normalized == 'yesterday':
        report_date = now.date() - timedelta(days=1)
    else:
        report_date = date.fromisoformat(raw_value)
    start = datetime.combine(report_date, time.min, tzinfo=timezone)
    end = start + timedelta(days=1)
    return report_date, start, end


def run_command(command: list[str], cwd: Path) -> tuple[int, str, str]:
    completed = subprocess.run(command, cwd=cwd, capture_output=True, text=True)
    return completed.returncode, completed.stdout, completed.stderr


def git_branch(repo_root: Path) -> str:
    code, stdout, _ = run_command(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], cwd=repo_root)
    return stdout.strip() if code == 0 else 'unknown'


def git_commits(repo_root: Path, start: datetime, end: datetime) -> list[dict[str, str]]:
    command = [
        'git',
        'log',
        f'--since={start.isoformat()}',
        f'--until={end.isoformat()}',
        '--date=iso-strict',
        '--pretty=format:%H\t%ad\t%s'
    ]
    code, stdout, _ = run_command(command, cwd=repo_root)
    if code != 0 or not stdout.strip():
        return []
    commits: list[dict[str, str]] = []
    for line in stdout.splitlines():
        commit_hash, committed_at, subject = (line.split('\t', 2) + ['', '', ''])[:3]
        commits.append(
            {
                'hash': commit_hash,
                'short_hash': commit_hash[:7],
                'committed_at': committed_at,
                'subject': subject.strip()
            }
        )
    return commits


def git_changed_files(repo_root: Path, commits: Iterable[dict[str, str]]) -> list[str]:
    seen: dict[str, None] = {}
    for commit in commits:
        code, stdout, _ = run_command(['git', 'show', '--pretty=format:', '--name-only', commit['hash']], cwd=repo_root)
        if code != 0:
            continue
        for line in stdout.splitlines():
            candidate = line.strip()
            if candidate:
                seen.setdefault(candidate, None)
    return list(seen.keys())


def git_worktree_status(repo_root: Path) -> list[str]:
    code, stdout, _ = run_command(['git', 'status', '--short'], cwd=repo_root)
    if code != 0:
        return []
    return [line.rstrip() for line in stdout.splitlines() if line.strip()]


def recent_output_artifacts(repo_root: Path, start: datetime, end: datetime, limit: int = 8) -> list[str]:
    candidates: list[tuple[float, str]] = []
    for relative_dir in ('out', 'outbound'):
        root = repo_root / relative_dir
        if not root.exists():
            continue
        for path in root.rglob('*'):
            if not path.is_file():
                continue
            modified = datetime.fromtimestamp(path.stat().st_mtime, tz=start.tzinfo)
            if start <= modified < end:
                candidates.append((modified.timestamp(), str(path.relative_to(repo_root))))
    candidates.sort(reverse=True)
    return [item[1] for item in candidates[:limit]]


def parse_tasks_csv(csv_path: Path) -> list[TaskRow]:
    if not csv_path.exists():
        return []
    with csv_path.open('r', encoding='utf-8-sig', newline='') as handle:
        reader = csv.DictReader(handle)
        rows: list[TaskRow] = []
        for order, raw_row in enumerate(reader):
            task_id = value_from_row(raw_row, 'ID')
            task = value_from_row(raw_row, 'Task')
            executor = value_from_row(raw_row, 'Executor')
            status = normalize_status(value_from_row(raw_row, 'Status'))
            evidence = value_from_row(raw_row, 'Evidence')
            blocker = value_from_row(raw_row, 'Blocker')
            rows.append(TaskRow(task_id, task, executor, status, evidence, blocker, order))
        return rows


def value_from_row(row: dict[str, str], prefix: str) -> str:
    lowered_prefix = prefix.lower()
    for key, value in row.items():
        if key and key.lower().startswith(lowered_prefix):
            return (value or '').strip()
    return ''


def normalize_status(raw_status: str) -> str:
    return raw_status.strip().lower() or 'unknown'


def highlight_tasks(tasks: list[TaskRow], status: str, day_tokens: list[str], limit: int = 3) -> list[TaskRow]:
    filtered = [task for task in tasks if task.status == status]
    dated = [task for task in filtered if any(token in task.evidence for token in day_tokens)]
    fallback = [task for task in filtered if task not in dated]
    return (dated + fallback)[:limit]


def load_preferences(preferences_file: Path) -> list[str]:
    if not preferences_file.exists():
        return [
            '需求先判断业务逻辑与字段口径，再决定是否开发。',
            '任务 SSOT 以 workspace Tasks.csv 为准，默认串行推进。',
            '代码完成后先 review，再做 QA，再考虑 push。'
        ]
    bullets: list[str] = []
    for line in preferences_file.read_text(encoding='utf-8').splitlines():
        candidate = line.strip()
        if candidate.startswith('- '):
            bullets.append(candidate[2:].strip())
    if bullets:
        return bullets
    return [line.strip() for line in preferences_file.read_text(encoding='utf-8').splitlines() if line.strip()]


def split_evidence_paths(rows: Iterable[TaskRow], limit: int = 8) -> list[str]:
    paths: list[str] = []
    for row in rows:
        for item in row.evidence.split(';'):
            candidate = item.strip()
            if candidate and candidate not in paths:
                paths.append(candidate)
            if len(paths) >= limit:
                return paths
    return paths


def render_markdown(
    report_date: date,
    timezone_name: str,
    repo_root: Path,
    branch: str,
    commits: list[dict[str, str]],
    changed_files: list[str],
    worktree_status: list[str],
    tasks: list[TaskRow],
    preferences: list[str],
    recent_artifacts: list[str],
    output_markdown_path: Path,
    output_json_path: Path
) -> str:
    counter = Counter(task.status for task in tasks)
    day_tokens = [report_date.strftime('%Y-%m-%d'), report_date.strftime('%Y%m%d')]
    done_tasks = highlight_tasks(tasks, 'done', day_tokens)
    doing_tasks = highlight_tasks(tasks, 'doing', day_tokens)
    blocked_tasks = highlight_tasks(tasks, 'blocked', day_tokens)
    lines: list[str] = []
    lines.append(f'# Eggturtle 日报 - {report_date.isoformat()}')
    lines.append('')
    lines.append('## 概览')
    lines.append(f'- 仓库：`{repo_root}`')
    lines.append(f'- 分支：`{branch}`')
    lines.append(f'- 时区：`{timezone_name}`')
    lines.append(f'- Git 提交：{len(commits)} 个；影响文件：{len(changed_files)} 个；未提交改动：{len(worktree_status)} 项')
    lines.append(
        f'- 任务面板：doing {counter.get("doing", 0)} / done {counter.get("done", 0)} / blocked {counter.get("blocked", 0)} / todo {counter.get("todo", 0)}'
    )
    lines.append('')
    lines.append('## 开发了什么')
    if commits:
        for commit in commits[:6]:
            lines.append(f'- `{commit["short_hash"]}` {commit["subject"]}')
    else:
        lines.append('- 今日没有新的 git commit；更可能发生在在途任务推进或本地验证。')
    if doing_tasks:
        lines.append('')
        lines.append('### 当前推进中的任务')
        for task in doing_tasks:
            suffix = f'（执行者：{task.executor}）' if task.executor else ''
            lines.append(f'- `{task.task_id}` {task.task}{suffix}')
    if done_tasks:
        lines.append('')
        lines.append('### 最近完成的任务')
        for task in done_tasks:
            lines.append(f'- `{task.task_id}` {task.task}')
    if changed_files:
        lines.append('')
        lines.append('### 影响文件')
        for path in changed_files[:10]:
            lines.append(f'- `{path}`')
    lines.append('')
    lines.append('## 存在什么问题')
    if blocked_tasks:
        for task in blocked_tasks:
            detail = f'：{task.evidence}' if task.evidence else ''
            lines.append(f'- `{task.task_id}` {task.task}{detail}')
    else:
        lines.append('- 当前 Tasks.csv 没有新的 blocked 高优先项进入摘要范围。')
    if worktree_status:
        lines.append(f'- 工作区仍有 {len(worktree_status)} 条未提交改动，定时任务应注意区分已提交结果与在途修改。')
        for item in worktree_status[:6]:
            lines.append(f'  - `{item}`')
    if not commits and not blocked_tasks and not worktree_status:
        lines.append('- 今日风险信号较少，可更多聚焦后续排期与验证。')
    lines.append('')
    lines.append('## 用户偏好与执行口径')
    for preference in preferences:
        lines.append(f'- {preference}')
    lines.append('')
    lines.append('## 证据与产出')
    evidence_paths = split_evidence_paths(done_tasks + doing_tasks, limit=10)
    if evidence_paths:
        for path in evidence_paths:
            lines.append(f'- `{path}`')
    if recent_artifacts:
        for artifact in recent_artifacts:
            if artifact not in evidence_paths:
                lines.append(f'- `{artifact}`')
    if not evidence_paths and not recent_artifacts:
        lines.append('- 今日没有捕获到新的 out/outbound 产物。')
    lines.append('')
    lines.append('## 本地落盘')
    lines.append(f'- Markdown：`{output_markdown_path}`')
    lines.append(f'- JSON：`{output_json_path}`')
    return '\n'.join(lines) + '\n'


def build_chat_message(report_date: date, title: str, commits: list[dict[str, str]], tasks: list[TaskRow], preferences: list[str]) -> str:
    day_tokens = [report_date.strftime('%Y-%m-%d'), report_date.strftime('%Y%m%d')]
    doing_tasks = highlight_tasks(tasks, 'doing', day_tokens, limit=2)
    done_tasks = highlight_tasks(tasks, 'done', day_tokens, limit=2)
    blocked_tasks = highlight_tasks(tasks, 'blocked', day_tokens, limit=2)
    lines = [f'【{title} {report_date.isoformat()}】']
    if commits:
        lines.append('开发：')
        for commit in commits[:3]:
            lines.append(f'- {commit["subject"]}')
    if done_tasks:
        lines.append('完成：')
        for task in done_tasks:
            lines.append(f'- {task.task_id} {task.task}')
    if doing_tasks:
        lines.append('进行中：')
        for task in doing_tasks:
            lines.append(f'- {task.task_id} {task.task}')
    if blocked_tasks:
        lines.append('问题：')
        for task in blocked_tasks:
            lines.append(f'- {task.task_id} {task.task}')
    if preferences:
        lines.append('偏好：')
        for preference in preferences[:3]:
            lines.append(f'- {preference}')
    return '\n'.join(lines)


def attempt_feishu_delivery(repo_root: Path, chat_id: str, message: str) -> dict[str, object]:
    command = ['openclaw', 'message', 'send', '--channel', 'feishu', '--target', chat_id, '--message', message, '--json']
    completed = subprocess.run(command, cwd=repo_root, capture_output=True, text=True)
    payload: dict[str, object] = {
        'attempted': True,
        'command': ' '.join(command[:-2]) + ' --message <omitted> --json',
        'returncode': completed.returncode,
        'stdout': completed.stdout.strip(),
        'stderr': completed.stderr.strip(),
        'ok': completed.returncode == 0
    }
    if completed.returncode != 0:
        payload['error'] = (completed.stderr or completed.stdout or 'openclaw message send failed').strip()
    return payload


def write_latest_snapshot(markdown_text: str, json_payload: dict[str, object], output_dir: Path) -> None:
    (output_dir / 'latest.md').write_text(markdown_text, encoding='utf-8')
    (output_dir / 'latest.json').write_text(json.dumps(json_payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main() -> int:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    tasks_csv = Path(args.tasks_csv)
    preferences_file = (repo_root / args.preferences_file).resolve() if not Path(args.preferences_file).is_absolute() else Path(args.preferences_file)
    output_dir = (repo_root / args.output_dir).resolve() if not Path(args.output_dir).is_absolute() else Path(args.output_dir)
    weekly_dir = output_dir.parent / 'weekly'
    output_dir.mkdir(parents=True, exist_ok=True)
    weekly_dir.mkdir(parents=True, exist_ok=True)

    report_date, start, end = resolve_report_date(args.date, args.timezone)
    branch = git_branch(repo_root)
    commits = git_commits(repo_root, start, end)
    changed_files = git_changed_files(repo_root, commits)
    worktree_status = git_worktree_status(repo_root)
    tasks = parse_tasks_csv(tasks_csv)
    preferences = load_preferences(preferences_file)
    artifacts = recent_output_artifacts(repo_root, start, end)

    output_markdown_path = output_dir / f'{report_date.isoformat()}.md'
    output_json_path = output_dir / f'{report_date.isoformat()}.json'
    markdown_text = render_markdown(
        report_date,
        args.timezone,
        repo_root,
        branch,
        commits,
        changed_files,
        worktree_status,
        tasks,
        preferences,
        artifacts,
        output_markdown_path,
        output_json_path
    )

    delivery: dict[str, object] = {'attempted': False, 'ok': None, 'error': None}
    if args.send_feishu:
        if not args.feishu_chat_id.strip():
            delivery = {
                'attempted': False,
                'ok': False,
                'error': '--send-feishu requires --feishu-chat-id'
            }
        else:
            chat_message = build_chat_message(report_date, args.message_title, commits, tasks, preferences)
            delivery = attempt_feishu_delivery(repo_root, args.feishu_chat_id.strip(), chat_message)

    json_payload: dict[str, object] = {
        'report_date': report_date.isoformat(),
        'timezone': args.timezone,
        'generated_at': datetime.now(ZoneInfo(args.timezone)).isoformat(),
        'repo_root': str(repo_root),
        'branch': branch,
        'tasks_csv': str(tasks_csv),
        'preferences_file': str(preferences_file),
        'git': {
            'commit_count': len(commits),
            'commits': commits,
            'changed_files': changed_files,
            'worktree_status': worktree_status
        },
        'tasks': {
            'counts': Counter(task.status for task in tasks),
            'top_done': [task.__dict__ for task in highlight_tasks(tasks, 'done', [report_date.strftime('%Y-%m-%d'), report_date.strftime('%Y%m%d')])],
            'top_doing': [task.__dict__ for task in highlight_tasks(tasks, 'doing', [report_date.strftime('%Y-%m-%d'), report_date.strftime('%Y%m%d')])],
            'top_blocked': [task.__dict__ for task in highlight_tasks(tasks, 'blocked', [report_date.strftime('%Y-%m-%d'), report_date.strftime('%Y%m%d')])]
        },
        'preferences': preferences,
        'artifacts': artifacts,
        'delivery': delivery,
        'outputs': {
            'markdown': str(output_markdown_path),
            'json': str(output_json_path),
            'latest_markdown': str(output_dir / 'latest.md'),
            'latest_json': str(output_dir / 'latest.json')
        }
    }

    output_markdown_path.write_text(markdown_text, encoding='utf-8')
    output_json_path.write_text(json.dumps(json_payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    write_latest_snapshot(markdown_text, json_payload, output_dir)

    if args.stdout:
        sys.stdout.write(markdown_text)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
