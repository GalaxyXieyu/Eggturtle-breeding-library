# Task SSOT migration note (2026-03-08)

## Current rule

- Current task SSOT: `/Users/apple/coding/.openclaw/workspace/workspaces/groups/eggturtle/eggturtle/tasks/Tasks.csv`
- Historical archive only: `docs/plan/EggsTask.csv`
- Effective immediately: agents, subagents, QA, and cron helpers should read/write the workspace SSOT only

## Files updated

- `AGENT.md`
- `CLAUDE.md`
- `subagents/eggturtle-qa/skills/ui-ux-test/references/profile.eggturtle.yaml`
- `scripts/cron_pr_cleanup.py`

## Notes

- `docs/plan/EggsTask.csv` was not modified to avoid breaking CSV structure and historical records.
- Requested memory files were not present at the audited paths during this fix, so no changes were made there.
- Any daemon/cron process that loaded old prompts before this change may need a restart/reload to pick up the new path references.
