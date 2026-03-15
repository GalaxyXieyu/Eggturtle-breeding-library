# T24 验证证据

## 复现命令（修复后）

```bash
python3 ~/.codex/skills/openclaw-lark-bridge/scripts/invoke_openclaw_tool.py \
  --tool feishu_task_tasklist \
  --action list
```

预期：输出不再只有 `{\"ok\": true}`，而是包含：
- `result`
- `details`
- `_request`
- `_meta`
- `_diagnosis`

对应实测输出文件：`outbound/t24/tasklist-list.json`

## 对照复现（旧请求形态）

直接调用 `/tools/invoke`，只传顶层 `action`、不把 `action` 放进 `args`：

```bash
python3 - <<'PY'
import json, os, urllib.request
from pathlib import Path
cfg = json.loads((Path.home()/'.openclaw'/'openclaw.json').read_text())
port = ((cfg.get('gateway') or {}).get('port')) or 18789
url = os.environ.get('OPENCLAW_GATEWAY_URL') or f'http://127.0.0.1:{port}'
token = os.environ.get('OPENCLAW_GATEWAY_TOKEN') or os.environ.get('CLAWDBOT_GATEWAY_TOKEN') or (((cfg.get('gateway') or {}).get('auth') or {}).get('token'))
body = {'tool': 'feishu_task_tasklist', 'action': 'list', 'args': {}}
req = urllib.request.Request(url.rstrip('/') + '/tools/invoke', data=json.dumps(body).encode(), headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}, method='POST')
with urllib.request.urlopen(req) as resp:
    raw = resp.read().decode('utf-8')
    print(json.dumps({'status': resp.status, 'body': json.loads(raw)}, ensure_ascii=False, indent=2))
PY
```

对应实测输出文件：`outbound/t24/direct-top-level-action-only.json`

## 其他证据

- dry-run 请求体：`outbound/t24/tasklist-list-dry-run.json`
- 其中可以看到 bridge 已自动把 `--action list` 镜像到 `body.args.action`
