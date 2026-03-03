#!/usr/bin/env python3
"""Generate A4 HTML certificate preview close to docs/static/certificate_template.jpg layout."""

from __future__ import annotations

import argparse
import base64
import hashlib
import html
import json
import mimetypes
import re
import subprocess
from datetime import datetime
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw

TEMPLATE_W = 1024
TEMPLATE_H = 1536


def normalize_code(value: str | None, default: str = "UNKNOWN") -> str:
    if not value:
        return default
    upper = str(value).upper().strip()
    cleaned = re.sub(r"[^A-Z0-9-]+", "-", upper)
    cleaned = re.sub(r"-{2,}", "-", cleaned).strip("-")
    return cleaned or default


def compact_family(raw: str | None, fallback: str) -> str:
    source = normalize_code(raw, fallback)
    token = source.split("-")[0] if source else fallback
    return token or "UNKNOWN"


def sanitize_line_code(raw: str | None, fallback: str) -> str:
    value = normalize_code(raw, fallback)
    return fallback if len(value) > 14 else value


def esc(value: str | None, default: str = "未登记") -> str:
    return html.escape(value if value else default)


def load_local_payload(product_code: str | None) -> dict:
    repo_root = Path(__file__).resolve().parents[1]
    loader = repo_root / "scripts" / "load_certificate_lineage.js"
    cmd = ["node", str(loader)]
    if product_code:
        cmd.extend(["--code", product_code])
    proc = subprocess.run(cmd, cwd=str(repo_root), capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or "load_certificate_lineage.js failed")
    data = json.loads(proc.stdout)
    if not isinstance(data, dict):
        raise RuntimeError("Invalid payload from local DB loader")
    return data


def file_to_data_uri(path: Path) -> str:
    mime, _ = mimetypes.guess_type(path.name)
    if not mime:
        mime = "image/jpeg"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def make_fake_qr_data_url(payload: str, size: int = 260) -> str:
    modules = 33
    qr = Image.new("RGB", (modules, modules), "white")
    draw = ImageDraw.Draw(qr)
    finders = ((0, 0), (modules - 7, 0), (0, modules - 7))

    def finder(ox: int, oy: int) -> None:
        draw.rectangle((ox, oy, ox + 6, oy + 6), fill="black")
        draw.rectangle((ox + 1, oy + 1, ox + 5, oy + 5), fill="white")
        draw.rectangle((ox + 2, oy + 2, ox + 4, oy + 4), fill="black")

    for ox, oy in finders:
        finder(ox, oy)

    bits = []
    for byte in hashlib.sha256(payload.encode("utf-8")).digest():
        for shift in range(8):
            bits.append((byte >> shift) & 1)

    index = 0
    for y in range(modules):
        for x in range(modules):
            inside_finder = any(ox <= x <= ox + 6 and oy <= y <= oy + 6 for ox, oy in finders)
            if inside_finder or x == 6 or y == 6:
                continue
            if bits[index % len(bits)]:
                draw.point((x, y), fill="black")
            index += 1

    qr = qr.resize((size, size), Image.Resampling.NEAREST)
    buf = BytesIO()
    qr.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def px_to_pct_x(px: int) -> str:
    return f"{(px / TEMPLATE_W) * 100:.4f}%"


def px_to_pct_y(px: int) -> str:
    return f"{(px / TEMPLATE_H) * 100:.4f}%"


def build_html(payload: dict, template_path: Path) -> str:
    now = datetime.now()
    subject_code = normalize_code(payload.get("subjectCode"), "UNKNOWN")
    line_family = compact_family(payload.get("lineFamily"), subject_code)
    line_code = sanitize_line_code(payload.get("lineCode"), line_family)
    subject_name = payload.get("subjectName") or subject_code

    sire = normalize_code(payload.get("sire"), "未登记")
    dam = normalize_code(payload.get("dam"), "未登记")
    sire_sire = normalize_code(payload.get("sireSire"), "未登记")
    sire_dam = normalize_code(payload.get("sireDam"), "未登记")
    dam_sire = normalize_code(payload.get("damSire"), "未登记")
    dam_dam = normalize_code(payload.get("damDam"), "未登记")

    cert_tail = hashlib.md5(f"{subject_code}|{now:%Y%m%d}".encode("utf-8")).hexdigest()[:4].upper()
    cert_no = f"EG-{now:%Y%m%d}-{subject_code}-{cert_tail}"
    issued_en = now.strftime("Issued on %B %d, %Y")
    issued_zh = now.strftime("登记日期：%Y年%m月%d日")
    verify_id = hashlib.sha1(cert_no.encode("utf-8")).hexdigest()[:8].upper()
    verify_url = f"https://eggturtle.cn/verify/{verify_id}"

    background_data_uri = file_to_data_uri(template_path)
    qr_data_uri = make_fake_qr_data_url(verify_url)

    # Coordinates based on 1024x1536 template; later mapped as percentages.
    cert_no_y = 365
    issued_en_y = 420
    issued_zh_y = 458
    left_x, right_x = 118, 592
    block_top_y = 560
    ancestor_title_y = 810
    anc_left_y = 900
    anc_right_y = 900
    parent_left_x, parent_right_x = 310, 545
    parent_y = 1112
    stamp_cx, stamp_cy = 185, 1168
    stamp_d = 168
    qr_x, qr_y, qr_s = 764, 1080, 160
    verify_id_y = 1312
    sign_x, sign_y = 98, 1322

    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>A4 Certificate Template Preview</title>
  <style>
    @page {{
      size: A4 portrait;
      margin: 0;
    }}
    * {{
      box-sizing: border-box;
    }}
    body {{
      margin: 0;
      background: #e9e4d7;
      display: grid;
      place-items: center;
      padding: 18px;
      color: #2d2315;
      font-family: "Times New Roman", "Songti SC", "STSong", serif;
    }}
    .page {{
      width: 210mm;
      height: 297mm;
      position: relative;
      background: #f5efe2;
      box-shadow: 0 22px 56px rgba(60, 42, 18, 0.24);
    }}
    .canvas {{
      position: absolute;
      left: 13mm;
      top: 10.5mm;
      width: 184mm;
      height: 276mm;
      background-image: url("{background_data_uri}");
      background-size: 100% 100%;
      background-repeat: no-repeat;
    }}
    .layer {{
      position: absolute;
      inset: 0;
      color: #2e2518;
      pointer-events: none;
    }}
    .center {{
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      white-space: nowrap;
      text-align: center;
    }}
    .cert-no {{
      top: {px_to_pct_y(cert_no_y)};
      font-size: clamp(18px, 2.8vw, 48px);
      font-weight: 700;
      letter-spacing: 0.4px;
    }}
    .issued-en {{
      top: {px_to_pct_y(issued_en_y)};
      font-size: clamp(13px, 1.55vw, 27px);
      font-weight: 600;
      color: #4b3b28;
    }}
    .issued-zh {{
      top: {px_to_pct_y(issued_zh_y)};
      font-size: clamp(12px, 1.38vw, 23px);
      color: #6a5638;
    }}
    .block {{
      position: absolute;
      width: 31%;
      line-height: 1.3;
    }}
    .block h4 {{
      margin: 0 0 6px;
      font-size: clamp(13px, 1.45vw, 25px);
      font-weight: 700;
      color: #3b2c1d;
    }}
    .block .main {{
      margin: 0;
      font-size: clamp(18px, 2.1vw, 36px);
      font-weight: 700;
    }}
    .block p {{
      margin: 0;
      font-size: clamp(11px, 1.12vw, 19px);
      color: #5f4c32;
    }}
    .left {{ left: {px_to_pct_x(left_x)}; top: {px_to_pct_y(block_top_y)}; }}
    .right {{ left: {px_to_pct_x(right_x)}; top: {px_to_pct_y(block_top_y)}; }}
    .ancestor-title {{
      top: {px_to_pct_y(ancestor_title_y)};
      font-size: clamp(13px, 1.6vw, 28px);
      font-weight: 700;
      color: #3d2f1f;
    }}
    .ancestor {{
      position: absolute;
      width: 34%;
      font-size: clamp(11px, 1.08vw, 18px);
      line-height: 1.36;
      color: #5f4d33;
    }}
    .ancestor p {{
      margin: 0;
    }}
    .ancestor-left {{ left: {px_to_pct_x(left_x)}; top: {px_to_pct_y(anc_left_y)}; }}
    .ancestor-right {{ left: {px_to_pct_x(right_x)}; top: {px_to_pct_y(anc_right_y)}; }}
    .parents {{
      position: absolute;
      width: 24%;
      font-size: clamp(11px, 1.12vw, 19px);
      line-height: 1.35;
      color: #453624;
      font-weight: 600;
    }}
    .parents p {{
      margin: 0;
    }}
    .parents-left {{ left: {px_to_pct_x(parent_left_x)}; top: {px_to_pct_y(parent_y)}; }}
    .parents-right {{ left: {px_to_pct_x(parent_right_x)}; top: {px_to_pct_y(parent_y)}; }}
    .seal {{
      position: absolute;
      left: {px_to_pct_x(stamp_cx - stamp_d // 2)};
      top: {px_to_pct_y(stamp_cy - stamp_d // 2)};
      width: {px_to_pct_x(stamp_d)};
      aspect-ratio: 1 / 1;
      border-radius: 50%;
      border: 5px solid #8b2d26;
      box-shadow: inset 0 0 0 3px rgba(139, 45, 38, 0.28);
      display: grid;
      place-items: center;
      text-align: center;
      color: #8b2d26;
      font-weight: 700;
      font-size: clamp(11px, 1.18vw, 20px);
      line-height: 1.35;
    }}
    .qr {{
      position: absolute;
      left: {px_to_pct_x(qr_x)};
      top: {px_to_pct_y(qr_y)};
      width: {px_to_pct_x(qr_s)};
      height: {px_to_pct_y(qr_s)};
      border: 2px solid #bca783;
      border-radius: 8px;
      overflow: hidden;
      background: rgba(255,255,255,0.25);
    }}
    .qr img {{
      width: 100%;
      height: 100%;
      display: block;
      image-rendering: pixelated;
    }}
    .verify {{
      position: absolute;
      left: {px_to_pct_x(qr_x)};
      top: {px_to_pct_y(verify_id_y)};
      width: {px_to_pct_x(qr_s)};
      text-align: center;
      font-size: clamp(11px, 1vw, 16px);
      color: #6f5a3d;
      letter-spacing: 0.4px;
    }}
    .signature {{
      position: absolute;
      left: {px_to_pct_x(sign_x)};
      top: {px_to_pct_y(sign_y)};
      font-size: clamp(28px, 3.3vw, 56px);
      color: #2e2418;
      font-family: "Snell Roundhand", "Zapfino", "Times New Roman", serif;
      letter-spacing: 0.4px;
    }}
  </style>
</head>
<body>
  <section class="page">
    <div class="canvas">
      <div class="layer">
        <div class="center cert-no">{html.escape(cert_no)}</div>
        <div class="center issued-en">{html.escape(issued_en)}</div>
        <div class="center issued-zh">{html.escape(issued_zh)}</div>

        <div class="block left">
          <h4>系别 (Line):</h4>
          <p class="main">{html.escape(line_family)}</p>
          <p>编号: {html.escape(line_code)}</p>
          <p>系别: {html.escape(line_family)}</p>
        </div>

        <div class="block right">
          <h4>母系 (Dam):</h4>
          <p class="main">{html.escape(subject_name)}</p>
          <p>编号: {esc(payload.get("subjectCode"), subject_code)}</p>
          <p>系别: {html.escape(line_family)}</p>
        </div>

        <div class="center ancestor-title">祖代信息</div>

        <div class="ancestor ancestor-left">
          <p>祖父 (Sire's Sire): {html.escape(sire_sire)}</p>
          <p>祖母 (Sire's Dam): {html.escape(sire_dam)}</p>
        </div>
        <div class="ancestor ancestor-right">
          <p>外祖父 (Dam's Sire): {html.escape(dam_sire)}</p>
          <p>外祖母 (Dam's Dam): {html.escape(dam_dam)}</p>
        </div>

        <div class="parents parents-left">
          <p>父系 (Sire): {html.escape(sire)}</p>
          <p>父祖母 (Sire's Dam): {html.escape(sire_dam)}</p>
        </div>
        <div class="parents parents-right">
          <p>母系 (Dam): {html.escape(dam)}</p>
          <p>外祖母 (Dam's Dam): {html.escape(dam_dam)}</p>
        </div>

        <div class="seal">蛋龟选育库<br/>认证</div>

        <div class="qr"><img src="{qr_data_uri}" alt="qr" /></div>
        <div class="verify">{html.escape(verify_id)}</div>

        <div class="signature">Hugo Yuan</div>
      </div>
    </div>
  </section>
</body>
</html>
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate A4 template-style certificate HTML.")
    parser.add_argument("--product-code", type=str, default=None, help="Optional product code from local DB")
    parser.add_argument(
        "--template",
        type=Path,
        default=Path("docs/static/certificate_template.jpg"),
        help="Template image path",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("out/certificate-a4-template-preview.html"),
        help="Output HTML path",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.template.exists():
        raise FileNotFoundError(f"template not found: {args.template}")

    payload = load_local_payload(args.product_code)
    html_text = build_html(payload, args.template)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(html_text, encoding="utf-8")

    print(f"Generated A4 HTML certificate: {args.output}")
    print(f"Data source: local-db:{payload.get('subjectCode')}")


if __name__ == "__main__":
    main()

