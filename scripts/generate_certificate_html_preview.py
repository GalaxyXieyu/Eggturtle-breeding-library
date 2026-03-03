#!/usr/bin/env python3
"""Generate a modern HTML pedigree certificate preview (data from local DB by default)."""

from __future__ import annotations

import argparse
import base64
import hashlib
import html
import json
import re
import subprocess
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw


def normalize_code(value: str | None, default: str = "UNKNOWN") -> str:
    if not value:
        return default
    upper = str(value).upper().strip()
    cleaned = re.sub(r"[^A-Z0-9-]+", "-", upper)
    cleaned = re.sub(r"-{2,}", "-", cleaned).strip("-")
    return cleaned or default


def compact_family(code: str) -> str:
    tokens = [token for token in code.split("-") if token]
    if not tokens:
        return "UNKNOWN"
    return tokens[0]


def pick_first(*values: str | None) -> str | None:
    for value in values:
        if value:
            return value
    return None


def url_to_data_uri(url: str | None, max_size: int = 600) -> str | None:
    if not url or not re.match(r"^https?://", url, flags=re.IGNORECASE):
        return None
    try:
        with urllib.request.urlopen(url, timeout=8) as response:
            raw = response.read()
        image = Image.open(BytesIO(raw)).convert("RGB")
        image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        buf = BytesIO()
        image.save(buf, format="JPEG", quality=86, optimize=True)
        encoded = base64.b64encode(buf.getvalue()).decode("ascii")
        return f"data:image/jpeg;base64,{encoded}"
    except Exception:
        return None


def load_local_payload(product_code: str | None) -> dict:
    repo_root = Path(__file__).resolve().parents[1]
    loader = repo_root / "scripts" / "load_certificate_lineage.js"
    cmd = ["node", str(loader)]
    if product_code:
        cmd.extend(["--code", product_code])
    proc = subprocess.run(cmd, cwd=str(repo_root), capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or "load_certificate_lineage failed")
    data = json.loads(proc.stdout)
    if not isinstance(data, dict):
        raise RuntimeError("Invalid payload from load_certificate_lineage.js")
    return data


def make_fake_qr_data_url(payload: str, size: int = 220) -> str:
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

    idx = 0
    for y in range(modules):
        for x in range(modules):
            inside_finder = any(ox <= x <= ox + 6 and oy <= y <= oy + 6 for ox, oy in finders)
            if inside_finder or x == 6 or y == 6:
                continue
            if bits[idx % len(bits)]:
                draw.point((x, y), fill="black")
            idx += 1

    qr = qr.resize((size, size), Image.Resampling.NEAREST)
    buf = BytesIO()
    qr.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def build_html(data: dict) -> str:
    subject_code = normalize_code(data.get("subjectCode"), "UNKNOWN")
    line_family = compact_family(normalize_code(data.get("lineFamily"), subject_code))
    cert_tail = hashlib.md5(subject_code.encode("utf-8")).hexdigest()[:4].upper()
    cert_no = f"EG-20260303-{subject_code}-{cert_tail}"
    issued_en = "Issued on March 03, 2026"
    issued_zh = "登记日期：2026年03月03日"
    verify_id = hashlib.sha1(cert_no.encode("utf-8")).hexdigest()[:8].upper()

    subject_img = pick_first(data.get("subjectImageUrl"), data.get("sireImageUrl"), data.get("damImageUrl"))
    sire_img = pick_first(data.get("sireImageUrl"), data.get("subjectImageUrl"))
    dam_img = pick_first(data.get("damImageUrl"), data.get("subjectImageUrl"), data.get("sireImageUrl"))
    subject_img_data = url_to_data_uri(subject_img)
    sire_img_data = url_to_data_uri(sire_img)
    dam_img_data = url_to_data_uri(dam_img)

    qr_data_url = make_fake_qr_data_url(f"https://eggturtle.cn/verify/{verify_id}")

    def esc(value: str | None, default: str = "未登记") -> str:
        return html.escape(value if value else default)

    subject_name = esc(data.get("subjectName"), subject_code)
    line_name = esc(line_family, line_family)

    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Egg Turtle Certificate Preview</title>
  <style>
    :root {{
      --paper: #f6f1e6;
      --ink: #2f2417;
      --soft: #6f5a3c;
      --line: #b9a581;
      --seal: #8b2d26;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(circle at 20% 15%, #fdf8ef 0%, #efe7d7 38%, #e9dec9 100%);
      color: var(--ink);
      font-family: "Times New Roman", "Songti SC", "STSong", serif;
    }}
    .certificate {{
      width: 1024px;
      height: 1536px;
      background:
        radial-gradient(circle at 50% 0%, rgba(255,255,255,0.55), rgba(255,255,255,0) 46%),
        linear-gradient(180deg, rgba(90,70,30,0.07), rgba(90,70,30,0.04) 18%, rgba(90,70,30,0.02) 52%, rgba(90,70,30,0.08));
      border: 2px solid var(--line);
      position: relative;
      padding: 34px;
      box-shadow: 0 24px 60px rgba(80, 60, 30, 0.22);
    }}
    .certificate::before {{
      content: "";
      position: absolute;
      inset: 14px;
      border: 1.5px solid #ccb998;
      pointer-events: none;
    }}
    .top {{
      text-align: center;
      margin-top: 26px;
    }}
    .top h1 {{
      margin: 0;
      font-size: 68px;
      line-height: 1;
      letter-spacing: 4px;
      font-weight: 700;
    }}
    .top h2 {{
      margin: 14px 0 0;
      font-size: 46px;
      letter-spacing: 3px;
      font-weight: 600;
    }}
    .top p {{
      margin: 10px 0 0;
      font-size: 30px;
      color: var(--soft);
      letter-spacing: 1px;
    }}
    .divider {{
      margin: 22px auto;
      width: 88%;
      border-top: 2px solid #c5b089;
      position: relative;
    }}
    .divider::after {{
      content: "✦";
      position: absolute;
      left: 50%;
      top: -18px;
      transform: translateX(-50%);
      color: #9d7f50;
      background: transparent;
      font-size: 24px;
    }}
    .cert-no {{
      text-align: center;
      font-size: 54px;
      font-weight: 700;
      margin-top: 6px;
      letter-spacing: 1px;
    }}
    .issued {{
      text-align: center;
      font-size: 28px;
      margin-top: 6px;
      color: #46321e;
    }}
    .issued.zh {{
      margin-top: 4px;
      color: #7c6440;
    }}
    .hero {{
      margin: 34px auto 0;
      width: 290px;
      height: 290px;
      border-radius: 20px;
      overflow: hidden;
      border: 3px solid #c8b18a;
      background: #ece2cb;
    }}
    .hero img {{
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }}
    .meta {{
      margin-top: 26px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 26px;
      padding: 0 36px;
      font-size: 26px;
    }}
    .meta h3 {{
      margin: 0 0 10px;
      font-size: 34px;
      color: #3e2e1b;
    }}
    .meta p {{
      margin: 6px 0;
      color: #5c4b31;
    }}
    .lineage {{
      margin: 30px 48px 0;
      border-top: 2px solid #ccb48b;
      border-bottom: 2px solid #ccb48b;
      padding: 20px 0;
    }}
    .lineage .title {{
      text-align: center;
      font-size: 36px;
      margin-bottom: 14px;
      color: #3e2e1b;
      font-weight: 700;
    }}
    .lineage-grid {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      font-size: 27px;
      color: #5e4a31;
    }}
    .lineage-grid p {{
      margin: 8px 0;
    }}
    .bottom {{
      margin: 38px 58px 0;
      display: grid;
      grid-template-columns: 210px 1fr 220px;
      align-items: start;
      gap: 22px;
    }}
    .seal {{
      width: 180px;
      height: 180px;
      border-radius: 50%;
      border: 8px solid var(--seal);
      display: grid;
      place-items: center;
      color: var(--seal);
      font-size: 28px;
      font-weight: 700;
      line-height: 1.4;
      box-shadow: inset 0 0 0 5px rgba(139, 45, 38, 0.22);
    }}
    .parents {{
      font-size: 28px;
      color: #3f301f;
      padding-top: 8px;
    }}
    .parents p {{
      margin: 10px 0;
    }}
    .qr {{
      border: 2px solid #bca581;
      border-radius: 12px;
      padding: 10px;
      text-align: center;
      background: rgba(255,255,255,0.35);
    }}
    .qr img {{
      width: 180px;
      height: 180px;
      display: block;
      margin: 0 auto;
      border: 1px solid #ab9872;
      background: white;
    }}
    .qr .verify {{
      margin-top: 10px;
      font-size: 24px;
      letter-spacing: 1px;
      color: #56422b;
    }}
    .signature {{
      margin: 28px 62px 0;
      font-size: 66px;
      font-family: "Snell Roundhand", "Zapfino", cursive;
      color: #2d2216;
    }}
    .footer {{
      text-align: center;
      margin-top: 12px;
      font-size: 23px;
      color: #675236;
      letter-spacing: 0.4px;
    }}
    .thumbs {{
      margin: 16px 58px 0;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }}
    .thumb {{
      height: 140px;
      border: 2px solid #c6b08a;
      border-radius: 14px;
      overflow: hidden;
      background: rgba(255,255,255,0.25);
    }}
    .thumb img {{
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }}
  </style>
</head>
<body>
  <article class="certificate">
    <header class="top">
      <h1>蛋龟选育库</h1>
      <h2>Official Pedigree Certificate</h2>
      <p>选育溯源档案</p>
    </header>
    <div class="divider"></div>
    <div class="cert-no">{html.escape(cert_no)}</div>
    <div class="issued">{html.escape(issued_en)}</div>
    <div class="issued zh">{html.escape(issued_zh)}</div>
    <div class="hero">
      <img src="{html.escape(subject_img_data or '')}" alt="subject" />
    </div>

    <section class="meta">
      <div>
        <h3>系别 (Line)</h3>
        <p>{line_name}</p>
        <p>编号：{esc(data.get("lineCode"), line_family)}</p>
        <p>系别：{line_name}</p>
      </div>
      <div>
        <h3>母系 (Dam)</h3>
        <p>{subject_name}</p>
        <p>编号：{esc(data.get("subjectCode"), subject_code)}</p>
        <p>系别：{line_name}</p>
      </div>
    </section>

    <section class="lineage">
      <div class="title">祖代信息</div>
      <div class="lineage-grid">
        <div>
          <p>祖父 (Sire's Sire): {esc(data.get("sireSire"))}</p>
          <p>祖母 (Sire's Dam): {esc(data.get("sireDam"))}</p>
        </div>
        <div>
          <p>外祖父 (Dam's Sire): {esc(data.get("damSire"))}</p>
          <p>外祖母 (Dam's Dam): {esc(data.get("damDam"))}</p>
        </div>
      </div>
    </section>

    <section class="bottom">
      <div class="seal">蛋龟选育库<br/>认证</div>
      <div class="parents">
        <p>父系 (Sire): {esc(data.get("sire"))}</p>
        <p>母系 (Dam): {esc(data.get("dam"))}</p>
        <p>父祖母 (Sire's Dam): {esc(data.get("sireDam"))}</p>
        <p>外祖母 (Dam's Dam): {esc(data.get("damDam"))}</p>
      </div>
      <div class="qr">
        <img src="{qr_data_url}" alt="verify-qr" />
        <div class="verify">验证 ID：{verify_id}</div>
      </div>
    </section>

    <section class="thumbs">
      <div class="thumb"><img src="{html.escape(sire_img_data or '')}" alt="sire" /></div>
      <div class="thumb"><img src="{html.escape(dam_img_data or '')}" alt="dam" /></div>
    </section>

    <div class="signature">Hugo Yuan</div>
    <div class="footer">This certificate certifies that the above turtle is registered under the Egg Turtle Breeding Registry.</div>
  </article>
</body>
</html>
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate modern HTML certificate preview.")
    parser.add_argument("--product-code", type=str, default=None, help="Optional product code from local DB")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("out/certificate-modern-preview.html"),
        help="Output HTML path",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    payload = load_local_payload(args.product_code)
    html_content = build_html(payload)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(html_content, encoding="utf-8")
    print(f"Generated HTML certificate: {args.output}")
    print(f"Data source: local-db:{payload.get('subjectCode')}")


if __name__ == "__main__":
    main()
