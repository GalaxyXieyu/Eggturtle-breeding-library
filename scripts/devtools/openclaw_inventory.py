#!/usr/bin/env python3
"""Inventory Eggturtle/OpenClaw workflow assets and skill locations.

This helper exists so the team does not need to manually remember where
workflow docs, prompts, workspace control files, and skill roots live.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_WORKSPACE_ROOT = Path(
    "/Users/apple/coding/.openclaw/workspace/workspaces/groups/eggturtle-lab/eggturtle-lab"
)


@dataclass
class Item:
    label: str
    path: str
    exists: bool


def item(label: str, path: Path) -> Item:
    return Item(label=label, path=str(path), exists=path.exists())


def collect_items(pairs: Iterable[tuple[str, Path]]) -> list[Item]:
    return [item(label, path) for label, path in pairs]


def collect_skill_files(root: Path) -> list[dict[str, str]]:
    if not root.exists():
        return []

    results: list[dict[str, str]] = []
    for skill_file in sorted(root.rglob("SKILL.md")):
        try:
            skill_name = skill_file.parent.name
            relative = skill_file.relative_to(root)
        except ValueError:
            skill_name = skill_file.parent.name
            relative = skill_file
        results.append(
            {
                "name": skill_name,
                "path": str(skill_file),
                "relative": str(relative),
            }
        )
    return results


def build_inventory(repo_root: Path, workspace_root: Path) -> dict:
    repo_assets = {
        "doc_entrypoints": [
            asdict(x)
            for x in collect_items(
                [
                    ("Docs README", repo_root / "docs/README.md"),
                    ("Workflow Inventory", repo_root / "docs/openclaw/workflow-and-assets-inventory.md"),
                    ("Daily Summary Guide", repo_root / "docs/openclaw/openclaw-daily-summary.md"),
                    ("Daily Summary Prompt Template", repo_root / "docs/openclaw/openclaw-daily-summary.prompt.template.md"),
                    ("Project Architecture", repo_root / "docs/project-architecture.md"),
                    ("Business Flows", repo_root / "docs/business-flows.md"),
                    ("Technical Reference", repo_root / "docs/technical-reference.md"),
                    ("UIUX Design", repo_root / "docs/uiux-design.md"),
                ]
            )
        ],
        "local_skills": [
            asdict(x)
            for x in collect_items(
                [
                    ("Repo skills root", repo_root / ".agents/skills"),
                ]
            )
        ],
        "scripts": [
            asdict(x)
            for x in collect_items(
                [
                    ("Inventory helper", repo_root / "scripts/devtools/openclaw_inventory.py"),
                    ("OpenClaw daily summary", repo_root / "scripts/openclaw_daily_summary.py"),
                    ("Register daily summary cron", repo_root / "scripts/register_openclaw_daily_summary.sh"),
                ]
            )
        ],
    }

    workspace_assets = {
        "control_files": [
            asdict(x)
            for x in collect_items(
                [
                    ("Workspace AGENTS", workspace_root / "AGENTS.md"),
                    ("Workspace WORKFLOW_AUTO", workspace_root / "WORKFLOW_AUTO.md"),
                    ("Workspace PROJECT_GUIDE", workspace_root / "PROJECT_GUIDE.md"),
                    ("Workspace TASKS README", workspace_root / "tasks/README.md"),
                    ("Task context template", workspace_root / "tasks/context/TEMPLATE.md"),
                    ("Workspace deep workflow note", workspace_root / "docs/openclaw/workflow-acp-openclaw.md"),
                    ("Dev workflow playbook", workspace_root / "playbooks/dev-workflow.md"),
                ]
            )
        ],
        "runtime_files": [
            asdict(x)
            for x in collect_items(
                [
                    ("Tasks CSV", workspace_root / "tasks/Tasks.csv"),
                    ("Task orchestrator state", workspace_root / "out/task-orchestrator/state.json"),
                    ("AUTO_QUEUE", workspace_root / "out/plan/AUTO_QUEUE.txt"),
                    ("PROGRESS summary", workspace_root / "out/plan/PROGRESS.md"),
                    ("BLOCKERS", workspace_root / "out/plan/BLOCKERS.md"),
                ]
            )
        ],
        "scripts": [
            asdict(x)
            for x in collect_items(
                [
                    ("task_orchestrator.py", workspace_root / "scripts/task_orchestrator.py"),
                    ("taskboard.py", workspace_root / "scripts/taskboard.py"),
                    ("cron_dispatch_plan.py", workspace_root / "scripts/cron_dispatch_plan.py"),
                    ("cron_review.py", workspace_root / "scripts/cron_review.py"),
                    ("cron_feishu_sync_plan.py", workspace_root / "scripts/cron_feishu_sync_plan.py"),
                ]
            )
        ],
    }

    skill_roots = [
        repo_root / ".agents/skills",
        Path("/Users/apple/coding/Awesome-Coding-Workflow/skills"),
        Path.home() / ".codex/skills",
    ]

    skills = {str(root): collect_skill_files(root) for root in skill_roots}

    return {
        "repo_root": str(repo_root),
        "workspace_root": str(workspace_root),
        "repo_assets": repo_assets,
        "workspace_assets": workspace_assets,
        "skill_roots": [str(root) for root in skill_roots],
        "skills": skills,
    }


def render_markdown(payload: dict) -> str:
    lines: list[str] = []
    lines.append("# Eggturtle / OpenClaw Inventory")
    lines.append("")
    lines.append(f"- Repo root: `{payload['repo_root']}`")
    lines.append(f"- Workspace root: `{payload['workspace_root']}`")
    lines.append("")

    def render_group(title: str, items: list[dict]) -> None:
        lines.append(f"## {title}")
        lines.append("")
        for entry in items:
            status = "ok" if entry.get("exists") else "missing"
            lines.append(f"- [{status}] {entry['label']}: `{entry['path']}`")
        lines.append("")

    render_group("Repo Docs / Scripts", payload["repo_assets"]["doc_entrypoints"] + payload["repo_assets"]["scripts"])
    render_group("Workspace Control Files", payload["workspace_assets"]["control_files"])
    render_group("Workspace Runtime Files", payload["workspace_assets"]["runtime_files"])
    render_group("Workspace Scripts", payload["workspace_assets"]["scripts"])

    lines.append("## Skill Roots")
    lines.append("")
    for root in payload["skill_roots"]:
        count = len(payload["skills"].get(root, []))
        lines.append(f"- `{root}` ({count} skills)")
    lines.append("")

    lines.append("## Skills")
    lines.append("")
    for root in payload["skill_roots"]:
        lines.append(f"### {root}")
        lines.append("")
        entries = payload["skills"].get(root, [])
        if not entries:
            lines.append("- (none)")
            lines.append("")
            continue
        for entry in entries:
            lines.append(f"- `{entry['name']}` -> `{entry['path']}`")
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", default=str(REPO_ROOT))
    parser.add_argument("--workspace-root", default=str(DEFAULT_WORKSPACE_ROOT))
    parser.add_argument("--format", choices=["json", "markdown"], default="markdown")
    args = parser.parse_args()

    payload = build_inventory(Path(args.repo_root).resolve(), Path(args.workspace_root).resolve())
    if args.format == "json":
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(render_markdown(payload))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
