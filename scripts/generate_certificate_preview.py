#!/usr/bin/env python3
"""Generate a turtle pedigree certificate preview image.

默认数据源为本地数据库（通过 scripts/load_certificate_lineage.js 读取）。
如果你只是想看 UI 版式，可显式传 --source mock。

Usage:
  python3 scripts/generate_certificate_preview.py
  python3 scripts/generate_certificate_preview.py --product-code CBM-001
  python3 scripts/generate_certificate_preview.py --template /path/to/template.jpg
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont, ImageOps

BASE_WIDTH = 1152
BASE_HEIGHT = 2048
TEMPLATE_WIDTH = 1024
TEMPLATE_HEIGHT = 1536

# 基于 1152x2048 的定版坐标（后续按比例缩放到任意输出尺寸）。
BASE_LAYOUT = {
    "subject_photo": (416, 560, 736, 915),
    "sire_thumb": (145, 1465, 335, 1665),
    "dam_thumb": (620, 1465, 810, 1665),
    "qr_box": (852, 1390, 1057, 1595),
    "stamp_center": (250, 1560),
    "left_info_origin": (140, 640),
    "right_info_origin": (740, 640),
    "ancestor_left_origin": (140, 980),
    "ancestor_right_origin": (740, 980),
    "parent_left_origin": (370, 1388),
    "parent_right_origin": (700, 1388),
    "signature_origin": (140, 1728),
    "header": {
        "title_en_y": 258,
        "title_cn_y": 290,
        "cert_no_y": 388,
        "issued_en_y": 438,
        "issued_zh_y": 470,
    },
    "footer": {
        "qr_title_y": 1628,
        "qr_id_y": 1652,
        "en_y": 1862,
        "zh_y": 1912,
    },
    "max_width": {
        "left_info": 320,
        "right_info": 320,
        "ancestor_left": 430,
        "ancestor_right": 310,
        "parent_left": 380,
        "parent_right": 300,
    },
}

TEMPLATE_LAYOUT = {
    "cert_no_y": 365,
    "issued_en_y": 420,
    "issued_zh_y": 458,
    "left_info_origin": (118, 560),
    "right_info_origin": (592, 560),
    "ancestor_title_y": 810,
    "ancestor_left_origin": (118, 900),
    "ancestor_right_origin": (592, 900),
    "parent_left_origin": (310, 1112),
    "parent_right_origin": (545, 1112),
    "stamp_center": (185, 1168),
    "qr_box": (764, 1080, 924, 1240),
    "verify_id_y": 1312,
    "signature_origin": (98, 1322),
    "max_width": {
        "center": 760,
        "left": 300,
        "right": 300,
        "ancestor_left": 340,
        "ancestor_right": 300,
        "parent_left": 225,
        "parent_right": 225,
    },
}


@dataclass
class CertificateData:
    cert_no: str
    issued_en: str
    issued_zh: str
    line_name: str
    line_code: str
    line_family: str
    dam_name: str
    dam_code: str
    dam_family: str
    sire: str
    dam: str
    sire_sire: str
    sire_dam: str
    dam_sire: str
    dam_dam: str
    verify_id: str
    verify_url: str
    source_label: str
    subject_image_url: str | None
    sire_image_url: str | None
    dam_image_url: str | None


def load_font(size: int, preferred: Iterable[str]) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in preferred:
        p = Path(path)
        if not p.exists():
            continue
        try:
            return ImageFont.truetype(str(p), size=size)
        except OSError:
            continue

    for fallback in ("Arial Unicode.ttf", "Arial Unicode MS.ttf", "DejaVuSerif.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(fallback, size=size)
        except OSError:
            continue

    return ImageFont.load_default()


def cn_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    return load_font(
        size,
        (
            "/System/Library/Fonts/PingFang.ttc",
            "/System/Library/Fonts/Hiragino Sans GB.ttc",
            "/System/Library/Fonts/STHeiti Medium.ttc",
            "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        ),
    )


def en_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    return load_font(
        size,
        (
            "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
            "/System/Library/Fonts/Supplemental/Georgia.ttf",
            "/System/Library/Fonts/Supplemental/Arial.ttf",
        ),
    )


def create_fallback_template(width: int, height: int) -> Image.Image:
    image = Image.new("RGBA", (width, height), "#f4efdf")
    draw = ImageDraw.Draw(image)

    # 简化版纸张底纹（无底图时的兜底样式）。
    draw.rectangle((20, 20, width - 20, height - 20), outline="#a88f5a", width=3)
    draw.rectangle((48, 48, width - 48, height - 48), outline="#bda775", width=2)

    for y in (350, 1000, 1385, 1720):
        draw.line((95, y, width - 95, y), fill="#bca471", width=2)

    cx, cy = width // 2, 980
    draw.ellipse((cx - 250, cy - 250, cx + 250, cy + 250), outline="#d7ccb1", width=8)
    draw.ellipse((cx - 190, cy - 190, cx + 190, cy + 190), outline="#ddd3bc", width=3)

    return image


def to_px_x(x: int, scale_x: float) -> int:
    return int(round(x * scale_x))


def to_px_y(y: int, scale_y: float) -> int:
    return int(round(y * scale_y))


def scale_rect(rect: tuple[int, int, int, int], sx: float, sy: float) -> tuple[int, int, int, int]:
    return (
        to_px_x(rect[0], sx),
        to_px_y(rect[1], sy),
        to_px_x(rect[2], sx),
        to_px_y(rect[3], sy),
    )


def scale_point(point: tuple[int, int], sx: float, sy: float) -> tuple[int, int]:
    return (to_px_x(point[0], sx), to_px_y(point[1], sy))


def build_layout(width: int, height: int) -> dict:
    sx = width / BASE_WIDTH
    sy = height / BASE_HEIGHT

    return {
        "subject_photo": scale_rect(BASE_LAYOUT["subject_photo"], sx, sy),
        "sire_thumb": scale_rect(BASE_LAYOUT["sire_thumb"], sx, sy),
        "dam_thumb": scale_rect(BASE_LAYOUT["dam_thumb"], sx, sy),
        "qr_box": scale_rect(BASE_LAYOUT["qr_box"], sx, sy),
        "stamp_center": scale_point(BASE_LAYOUT["stamp_center"], sx, sy),
        "left_info_origin": scale_point(BASE_LAYOUT["left_info_origin"], sx, sy),
        "right_info_origin": scale_point(BASE_LAYOUT["right_info_origin"], sx, sy),
        "ancestor_left_origin": scale_point(BASE_LAYOUT["ancestor_left_origin"], sx, sy),
        "ancestor_right_origin": scale_point(BASE_LAYOUT["ancestor_right_origin"], sx, sy),
        "parent_left_origin": scale_point(BASE_LAYOUT["parent_left_origin"], sx, sy),
        "parent_right_origin": scale_point(BASE_LAYOUT["parent_right_origin"], sx, sy),
        "signature_origin": scale_point(BASE_LAYOUT["signature_origin"], sx, sy),
        "header": {k: to_px_y(v, sy) for k, v in BASE_LAYOUT["header"].items()},
        "footer": {k: to_px_y(v, sy) for k, v in BASE_LAYOUT["footer"].items()},
        "max_width": {k: to_px_x(v, sx) for k, v in BASE_LAYOUT["max_width"].items()},
    }


def draw_center(
    draw: ImageDraw.ImageDraw, image_width: int, y: int, text: str, font: ImageFont.ImageFont, fill: str
) -> None:
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    x = (image_width - text_w) // 2
    draw.text((x, y), text, font=font, fill=fill)


def draw_center_fit(
    draw: ImageDraw.ImageDraw,
    image_width: int,
    y: int,
    text: str,
    font_factory,
    max_size: int,
    min_size: int,
    max_width: int,
    fill: str,
) -> None:
    size = max_size
    while size >= min_size:
        font = font_factory(size)
        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
        if text_w <= max_width:
            draw.text(((image_width - text_w) // 2, y), text, font=font, fill=fill)
            return
        size -= 1
    font = font_factory(min_size)
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    draw.text(((image_width - text_w) // 2, y), text, font=font, fill=fill)


def draw_center_in_box(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    y: int,
    text: str,
    font: ImageFont.ImageFont,
    fill: str,
) -> None:
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    x = box[0] + max(0, ((box[2] - box[0]) - text_w) // 2)
    draw.text((x, y), text, font=font, fill=fill)


def draw_left_fit(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    text: str,
    font_factory,
    max_size: int,
    min_size: int,
    max_width: int,
    fill: str,
) -> None:
    size = max_size
    while size >= min_size:
        font = font_factory(size)
        bbox = draw.textbbox((0, 0), text, font=font)
        if (bbox[2] - bbox[0]) <= max_width:
            draw.text((x, y), text, font=font, fill=fill)
            return
        size -= 1
    draw.text((x, y), text, font=font_factory(min_size), fill=fill)


def draw_layout_debug(draw: ImageDraw.ImageDraw, layout: dict) -> None:
    rect_color = "#3b82f6"
    label_color = "#1d4ed8"
    for key in ("subject_photo", "sire_thumb", "dam_thumb", "qr_box"):
        box = layout[key]
        draw.rectangle(box, outline=rect_color, width=2)
        draw.text((box[0] + 6, box[1] + 6), key, font=en_font(14), fill=label_color)

    for key in ("left_info_origin", "right_info_origin", "ancestor_left_origin", "ancestor_right_origin", "parent_left_origin", "parent_right_origin"):
        x, y = layout[key]
        draw.ellipse((x - 4, y - 4, x + 4, y + 4), fill="#ef4444")
        draw.text((x + 8, y - 8), key, font=en_font(12), fill="#b91c1c")


def load_remote_image(url: str | None) -> Image.Image | None:
    if not url or not re.match(r"^https?://", url, flags=re.IGNORECASE):
        return None

    try:
        with urllib.request.urlopen(url, timeout=8) as response:
            data = response.read()
        image = Image.open(BytesIO(data)).convert("RGB")
        return image
    except Exception:
        return None


def pick_best_image(*urls: str | None) -> Image.Image | None:
    for url in urls:
        image = load_remote_image(url)
        if image is not None:
            return image
    return None


def paste_cover(image: Image.Image, source: Image.Image | None, box: tuple[int, int, int, int]) -> None:
    if source is None:
        draw = ImageDraw.Draw(image)
        draw.rounded_rectangle(box, radius=18, outline="#b6a782", width=2)
        draw.line((box[0], box[1], box[2], box[3]), fill="#d1c6ab", width=2)
        draw.line((box[0], box[3], box[2], box[1]), fill="#d1c6ab", width=2)
        return

    target_w = max(1, box[2] - box[0])
    target_h = max(1, box[3] - box[1])
    fitted = ImageOps.fit(source, (target_w, target_h), method=Image.Resampling.LANCZOS)
    image.paste(fitted, (box[0], box[1]))

    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(box, radius=18, outline="#8b7a53", width=2)


def draw_fake_qr(payload: str, size: int = 220) -> Image.Image:
    modules = 33
    qr = Image.new("RGB", (modules, modules), "white")
    qd = ImageDraw.Draw(qr)

    finder_origins = ((0, 0), (modules - 7, 0), (0, modules - 7))

    def draw_finder(ox: int, oy: int) -> None:
        qd.rectangle((ox, oy, ox + 6, oy + 6), fill="black")
        qd.rectangle((ox + 1, oy + 1, ox + 5, oy + 5), fill="white")
        qd.rectangle((ox + 2, oy + 2, ox + 4, oy + 4), fill="black")

    for ox, oy in finder_origins:
        draw_finder(ox, oy)

    seed = hashlib.sha256(payload.encode("utf-8")).digest()
    bits = []
    for byte in seed:
        for shift in range(8):
            bits.append((byte >> shift) & 1)

    bit_index = 0
    for y in range(modules):
        for x in range(modules):
            in_finder = any(ox <= x <= ox + 6 and oy <= y <= oy + 6 for ox, oy in finder_origins)
            if in_finder:
                continue
            if x == 6 or y == 6:
                continue
            bit = bits[bit_index % len(bits)]
            bit_index += 1
            if bit:
                qd.point((x, y), fill="black")

    return qr.resize((size, size), Image.Resampling.NEAREST)


def draw_stamp(draw: ImageDraw.ImageDraw, cx: int, cy: int, scale: float) -> None:
    radius = int(95 * scale)
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), outline="#8b2d26", width=max(2, int(6 * scale)))
    draw.ellipse(
        (cx - int(72 * scale), cy - int(72 * scale), cx + int(72 * scale), cy + int(72 * scale)),
        outline="#8b2d26",
        width=max(1, int(3 * scale)),
    )

    label_font = cn_font(max(12, int(22 * scale)))
    center_font = cn_font(max(13, int(24 * scale)))

    top_text = "选育溯源档案"
    top_box = draw.textbbox((0, 0), top_text, font=label_font)
    draw.text((cx - (top_box[2] - top_box[0]) // 2, cy - int(52 * scale)), top_text, fill="#8b2d26", font=label_font)

    center_text = "认证"
    center_box = draw.textbbox((0, 0), center_text, font=center_font)
    draw.text(
        (cx - (center_box[2] - center_box[0]) // 2, cy - int(12 * scale)),
        center_text,
        fill="#8b2d26",
        font=center_font,
    )


def normalize_code(value: str | None, default: str) -> str:
    if not value:
        return default
    upper = str(value).upper().strip()
    cleaned = re.sub(r"[^A-Z0-9-]+", "-", upper)
    cleaned = re.sub(r"-{2,}", "-", cleaned).strip("-")
    return cleaned or default


def compact_family(value: str | None, fallback_code: str) -> str:
    raw = (value or fallback_code or "").strip().upper()
    tokens = [token for token in raw.split("-") if token]
    if not tokens:
        return "UNKNOWN"
    return tokens[0]


def sanitize_line_code(raw: str | None, family_fallback: str) -> str:
    value = normalize_code(raw, family_fallback)
    # 数据里 seriesId 可能是长随机 ID，不适合放证书展示。
    if len(value) > 14:
        return family_fallback
    return value


def load_local_payload(product_code: str | None) -> dict[str, str | None]:
    repo_root = Path(__file__).resolve().parents[1]
    loader = repo_root / "scripts" / "load_certificate_lineage.js"
    cmd = ["node", str(loader)]
    if product_code:
        cmd.extend(["--code", product_code])

    proc = subprocess.run(
        cmd,
        cwd=str(repo_root),
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        stderr = proc.stderr.strip()
        stdout = proc.stdout.strip()
        raise RuntimeError(stderr or stdout or "load_certificate_lineage.js failed")

    payload = json.loads(proc.stdout)
    if not isinstance(payload, dict):
        raise RuntimeError("Invalid JSON payload from local DB loader.")
    return payload


def build_data_from_local_payload(payload: dict[str, str | None], now: datetime) -> CertificateData:
    subject_code = normalize_code(payload.get("subjectCode"), "UNKNOWN")
    subject_name = payload.get("subjectName") or subject_code

    line_family = compact_family(payload.get("lineFamily"), subject_code)
    raw_line_name = payload.get("lineName") or line_family
    line_name = str(raw_line_name)
    if len(line_name) > 10:
        line_name = line_family
    line_code = sanitize_line_code(payload.get("lineCode"), line_family)

    sire_code = normalize_code(payload.get("sire"), "未登记")
    dam_code = normalize_code(payload.get("dam"), "未登记")
    sire_sire = normalize_code(payload.get("sireSire"), "未登记")
    sire_dam = normalize_code(payload.get("sireDam"), "未登记")
    dam_sire = normalize_code(payload.get("damSire"), "未登记")
    dam_dam = normalize_code(payload.get("damDam"), "未登记")

    cert_seed = f"{subject_code}|{sire_code}|{dam_code}|{now:%Y%m%d}"
    cert_tail = hashlib.md5(cert_seed.encode("utf-8")).hexdigest()[:4].upper()
    cert_no = f"EG-{now:%Y%m%d}-{subject_code}-{cert_tail}"

    verify_id = hashlib.sha1(cert_no.encode("utf-8")).hexdigest()[:8].upper()
    verify_url = f"https://eggturtle.cn/verify/{verify_id}"

    return CertificateData(
        cert_no=cert_no,
        issued_en=now.strftime("Issued on %B %d, %Y"),
        issued_zh=now.strftime("登记日期：%Y年%m月%d日"),
        line_name=str(line_name),
        line_code=line_code,
        line_family=line_family,
        dam_name=str(subject_name),
        dam_code=subject_code,
        dam_family=line_family,
        sire=sire_code,
        dam=dam_code,
        sire_sire=sire_sire,
        sire_dam=sire_dam,
        dam_sire=dam_sire,
        dam_dam=dam_dam,
        verify_id=verify_id,
        verify_url=verify_url,
        source_label=f"local-db:{subject_code}",
        subject_image_url=payload.get("subjectImageUrl"),
        sire_image_url=payload.get("sireImageUrl"),
        dam_image_url=payload.get("damImageUrl"),
    )


def build_mock_data(now: datetime) -> CertificateData:
    # 仅作为兜底调试数据；默认不会使用。
    line_name = "果核"
    line_code = "GH-F01"
    dam_name = "果核母 01"
    dam_code = "GH-F01"
    sire_code = "GH-M88"
    mother_code = "GH-F66"
    sire_sire_code = "GH-M18"
    sire_dam_code = "GH-F17"
    dam_sire_code = "GH-M11"
    dam_dam_code = "GH-F10"

    cert_seed = f"{line_code}-{now:%Y%m%d}"
    cert_tail = hashlib.md5(cert_seed.encode("utf-8")).hexdigest()[:4].upper()
    cert_no = f"EG-{now:%Y%m%d}-GH-GHF01-{cert_tail}"

    verify_id = hashlib.sha1(cert_no.encode("utf-8")).hexdigest()[:8].upper()
    verify_url = f"https://eggturtle.cn/verify/{verify_id}"

    return CertificateData(
        cert_no=cert_no,
        issued_en=now.strftime("Issued on %B %d, %Y"),
        issued_zh=now.strftime("登记日期：%Y年%m月%d日"),
        line_name=line_name,
        line_code=line_code,
        line_family="GH",
        dam_name=dam_name,
        dam_code=dam_code,
        dam_family="GH",
        sire=sire_code,
        dam=mother_code,
        sire_sire=sire_sire_code,
        sire_dam=sire_dam_code,
        dam_sire=dam_sire_code,
        dam_dam=dam_dam_code,
        verify_id=verify_id,
        verify_url=verify_url,
        source_label="mock:GH-F01",
        subject_image_url=None,
        sire_image_url=None,
        dam_image_url=None,
    )


def scale_template_layout(width: int, height: int) -> dict:
    sx = width / TEMPLATE_WIDTH
    sy = height / TEMPLATE_HEIGHT
    return {
        "cert_no_y": to_px_y(TEMPLATE_LAYOUT["cert_no_y"], sy),
        "issued_en_y": to_px_y(TEMPLATE_LAYOUT["issued_en_y"], sy),
        "issued_zh_y": to_px_y(TEMPLATE_LAYOUT["issued_zh_y"], sy),
        "left_info_origin": scale_point(TEMPLATE_LAYOUT["left_info_origin"], sx, sy),
        "right_info_origin": scale_point(TEMPLATE_LAYOUT["right_info_origin"], sx, sy),
        "ancestor_title_y": to_px_y(TEMPLATE_LAYOUT["ancestor_title_y"], sy),
        "ancestor_left_origin": scale_point(TEMPLATE_LAYOUT["ancestor_left_origin"], sx, sy),
        "ancestor_right_origin": scale_point(TEMPLATE_LAYOUT["ancestor_right_origin"], sx, sy),
        "parent_left_origin": scale_point(TEMPLATE_LAYOUT["parent_left_origin"], sx, sy),
        "parent_right_origin": scale_point(TEMPLATE_LAYOUT["parent_right_origin"], sx, sy),
        "stamp_center": scale_point(TEMPLATE_LAYOUT["stamp_center"], sx, sy),
        "qr_box": scale_rect(TEMPLATE_LAYOUT["qr_box"], sx, sy),
        "verify_id_y": to_px_y(TEMPLATE_LAYOUT["verify_id_y"], sy),
        "signature_origin": scale_point(TEMPLATE_LAYOUT["signature_origin"], sx, sy),
        "max_width": {k: to_px_x(v, sx) for k, v in TEMPLATE_LAYOUT["max_width"].items()},
    }


def render_static_template(
    image: Image.Image,
    data: CertificateData,
    layout_debug: bool = False,
    layout_dump_path: Path | None = None,
) -> None:
    draw = ImageDraw.Draw(image)
    width, height = image.size
    scale = min(width / TEMPLATE_WIDTH, height / TEMPLATE_HEIGHT)
    layout = scale_template_layout(width, height)

    if layout_dump_path:
        payload = json.dumps(layout, ensure_ascii=False, indent=2)
        layout_dump_path.parent.mkdir(parents=True, exist_ok=True)
        layout_dump_path.write_text(payload, encoding="utf-8")

    ink = "#2d2315"
    soft_ink = "#5b4a34"

    # 仅填充动态信息，避免覆盖模板自带标题与底文。
    draw_center_fit(
        draw,
        width,
        layout["cert_no_y"],
        data.cert_no,
        en_font,
        max_size=max(24, int(56 * scale)),
        min_size=max(16, int(32 * scale)),
        max_width=layout["max_width"]["center"],
        fill=ink,
    )
    draw_center_fit(
        draw,
        width,
        layout["issued_en_y"],
        data.issued_en,
        en_font,
        max_size=max(16, int(32 * scale)),
        min_size=max(12, int(20 * scale)),
        max_width=layout["max_width"]["center"],
        fill=ink,
    )
    draw_center_fit(
        draw,
        width,
        layout["issued_zh_y"],
        data.issued_zh,
        cn_font,
        max_size=max(15, int(30 * scale)),
        min_size=max(12, int(18 * scale)),
        max_width=layout["max_width"]["center"],
        fill=ink,
    )

    left_x, left_y = layout["left_info_origin"]
    right_x, right_y = layout["right_info_origin"]
    label_max = max(16, int(26 * scale))
    body_max = max(14, int(22 * scale))

    draw_left_fit(
        draw,
        left_x,
        left_y,
        "系别 (Line):",
        cn_font,
        max_size=label_max,
        min_size=12,
        max_width=layout["max_width"]["left"],
        fill=ink,
    )
    draw_left_fit(
        draw,
        left_x,
        left_y + int(42 * scale),
        data.line_name,
        cn_font,
        max_size=max(22, int(40 * scale)),
        min_size=16,
        max_width=layout["max_width"]["left"],
        fill=ink,
    )
    draw_left_fit(
        draw,
        left_x,
        left_y + int(84 * scale),
        f"编号: {data.line_code}",
        cn_font,
        max_size=body_max,
        min_size=12,
        max_width=layout["max_width"]["left"],
        fill=soft_ink,
    )
    draw_left_fit(
        draw,
        left_x,
        left_y + int(118 * scale),
        f"系别: {data.line_family}",
        cn_font,
        max_size=body_max,
        min_size=12,
        max_width=layout["max_width"]["left"],
        fill=soft_ink,
    )

    draw_left_fit(
        draw,
        right_x,
        right_y,
        "母系 (Dam):",
        cn_font,
        max_size=label_max,
        min_size=12,
        max_width=layout["max_width"]["right"],
        fill=ink,
    )
    draw_left_fit(
        draw,
        right_x,
        right_y + int(42 * scale),
        data.dam_name,
        cn_font,
        max_size=max(22, int(40 * scale)),
        min_size=16,
        max_width=layout["max_width"]["right"],
        fill=ink,
    )
    draw_left_fit(
        draw,
        right_x,
        right_y + int(84 * scale),
        f"编号: {data.dam_code}",
        cn_font,
        max_size=body_max,
        min_size=12,
        max_width=layout["max_width"]["right"],
        fill=soft_ink,
    )
    draw_left_fit(
        draw,
        right_x,
        right_y + int(118 * scale),
        f"系别: {data.dam_family}",
        cn_font,
        max_size=body_max,
        min_size=12,
        max_width=layout["max_width"]["right"],
        fill=soft_ink,
    )

    draw_center_fit(
        draw,
        width,
        layout["ancestor_title_y"],
        "祖代信息",
        cn_font,
        max_size=max(16, int(28 * scale)),
        min_size=12,
        max_width=layout["max_width"]["center"],
        fill=ink,
    )

    ax_l, ay_l = layout["ancestor_left_origin"]
    ax_r, ay_r = layout["ancestor_right_origin"]
    ancestor_size = max(14, int(22 * scale))
    draw_left_fit(
        draw,
        ax_l,
        ay_l,
        f"祖父 (Sire's Sire): {data.sire_sire}",
        cn_font,
        max_size=ancestor_size,
        min_size=12,
        max_width=layout["max_width"]["ancestor_left"],
        fill=soft_ink,
    )
    draw_left_fit(
        draw,
        ax_l,
        ay_l + int(34 * scale),
        f"祖母 (Sire's Dam): {data.sire_dam}",
        cn_font,
        max_size=ancestor_size,
        min_size=12,
        max_width=layout["max_width"]["ancestor_left"],
        fill=soft_ink,
    )
    draw_left_fit(
        draw,
        ax_r,
        ay_r,
        f"外祖父 (Dam's Sire): {data.dam_sire}",
        cn_font,
        max_size=ancestor_size,
        min_size=12,
        max_width=layout["max_width"]["ancestor_right"],
        fill=soft_ink,
    )
    draw_left_fit(
        draw,
        ax_r,
        ay_r + int(34 * scale),
        f"外祖母 (Dam's Dam): {data.dam_dam}",
        cn_font,
        max_size=ancestor_size,
        min_size=12,
        max_width=layout["max_width"]["ancestor_right"],
        fill=soft_ink,
    )

    px_l, py_l = layout["parent_left_origin"]
    px_r, py_r = layout["parent_right_origin"]
    parent_size = max(16, int(24 * scale))
    draw_left_fit(
        draw,
        px_l,
        py_l,
        f"父系 (Sire): {data.sire}",
        cn_font,
        max_size=parent_size,
        min_size=12,
        max_width=layout["max_width"]["parent_left"],
        fill=ink,
    )
    draw_left_fit(
        draw,
        px_l,
        py_l + int(34 * scale),
        f"父祖母 (Sire's Dam): {data.sire_dam}",
        cn_font,
        max_size=parent_size,
        min_size=12,
        max_width=layout["max_width"]["parent_left"],
        fill=ink,
    )
    draw_left_fit(
        draw,
        px_r,
        py_r,
        f"母系 (Dam): {data.dam}",
        cn_font,
        max_size=parent_size,
        min_size=12,
        max_width=layout["max_width"]["parent_right"],
        fill=ink,
    )
    draw_left_fit(
        draw,
        px_r,
        py_r + int(34 * scale),
        f"外祖母 (Dam's Dam): {data.dam_dam}",
        cn_font,
        max_size=parent_size,
        min_size=12,
        max_width=layout["max_width"]["parent_right"],
        fill=ink,
    )

    # 模板证书模式：只保留印章+二维码，移除杂乱缩略图。
    stamp_x, stamp_y = layout["stamp_center"]
    draw_stamp(draw, stamp_x, stamp_y, scale)

    qr_box = layout["qr_box"]
    qr_size = max(1, qr_box[2] - qr_box[0])
    qr = draw_fake_qr(f"{data.verify_url}|{data.verify_id}", size=qr_size)
    image.paste(qr, (qr_box[0], qr_box[1]))

    draw_center_in_box(
        draw,
        qr_box,
        layout["verify_id_y"],
        data.verify_id,
        en_font(max(13, int(18 * scale))),
        soft_ink,
    )

    draw.text(
        layout["signature_origin"],
        "Hugo Yuan",
        font=en_font(max(24, int(52 * scale))),
        fill=ink,
    )

    if layout_debug:
        draw_layout_debug(
            draw,
            {
                "subject_photo": qr_box,
                "sire_thumb": qr_box,
                "dam_thumb": qr_box,
                "qr_box": qr_box,
                "left_info_origin": layout["left_info_origin"],
                "right_info_origin": layout["right_info_origin"],
                "ancestor_left_origin": layout["ancestor_left_origin"],
                "ancestor_right_origin": layout["ancestor_right_origin"],
                "parent_left_origin": layout["parent_left_origin"],
                "parent_right_origin": layout["parent_right_origin"],
            },
        )


def render_certificate(
    data: CertificateData,
    output_path: Path,
    template_path: Path | None,
    layout_debug: bool = False,
    layout_dump_path: Path | None = None,
) -> None:
    has_static_template = bool(template_path and template_path.exists())
    if has_static_template:
        image = Image.open(template_path).convert("RGBA")
        render_static_template(
            image=image,
            data=data,
            layout_debug=layout_debug,
            layout_dump_path=layout_dump_path,
        )
        output_path.parent.mkdir(parents=True, exist_ok=True)
        image.convert("RGB").save(output_path, format="PNG")
        return
    else:
        image = create_fallback_template(BASE_WIDTH, BASE_HEIGHT)

    draw = ImageDraw.Draw(image)
    width, height = image.size
    scale = min(width / BASE_WIDTH, height / BASE_HEIGHT)
    layout = build_layout(width, height)

    if layout_dump_path:
        payload = json.dumps(layout, ensure_ascii=False, indent=2)
        layout_dump_path.parent.mkdir(parents=True, exist_ok=True)
        layout_dump_path.write_text(payload, encoding="utf-8")

    title_cn_font = cn_font(max(24, int(34 * scale)))
    title_en_font = en_font(max(18, int(24 * scale)))
    cert_no_font = en_font(max(28, int(44 * scale)))
    issued_en_font = en_font(max(21, int(28 * scale)))
    issued_zh_font = cn_font(max(20, int(26 * scale)))

    section_label_font = cn_font(max(20, int(28 * scale)))
    footer_en_font = en_font(max(14, int(20 * scale)))
    footer_zh_font = cn_font(max(13, int(16 * scale)))

    ink = "#2d2315"
    soft_ink = "#5b4a34"

    if not has_static_template:
        draw_center(draw, width, layout["header"]["title_en_y"], "OFFICIAL PEDIGREE CERTIFICATE", title_en_font, ink)
        draw_center(draw, width, layout["header"]["title_cn_y"], "官方繁育血统证书", title_cn_font, ink)

    cert_y = layout["header"]["cert_no_y"]
    issued_en_y = layout["header"]["issued_en_y"]
    issued_zh_y = layout["header"]["issued_zh_y"]
    if has_static_template:
        # 模板自带中英标题，需要把证书编号整体下移，避免重叠。
        cert_y += int(70 * scale)
        issued_en_y += int(70 * scale)
        issued_zh_y += int(70 * scale)

    draw_center(draw, width, cert_y, data.cert_no, cert_no_font, ink)
    draw_center(draw, width, issued_en_y, data.issued_en, issued_en_font, ink)
    draw_center(draw, width, issued_zh_y, data.issued_zh, issued_zh_font, ink)

    # 图片区：补上用户关心的“种龟图”。
    subject_image = pick_best_image(data.subject_image_url, data.sire_image_url, data.dam_image_url)
    sire_image = pick_best_image(data.sire_image_url, data.subject_image_url)
    dam_image = pick_best_image(data.dam_image_url, data.subject_image_url, data.sire_image_url)

    paste_cover(image, subject_image, layout["subject_photo"])
    paste_cover(image, sire_image, layout["sire_thumb"])
    paste_cover(image, dam_image, layout["dam_thumb"])

    left_x, y_top = layout["left_info_origin"]
    right_x, _ = layout["right_info_origin"]

    draw.text((left_x, y_top), "系别 (Line):", font=section_label_font, fill=ink)
    draw_left_fit(
        draw,
        left_x,
        y_top + int(32 * scale),
        data.line_name,
        cn_font,
        max(28, int(40 * scale)),
        18,
        layout["max_width"]["left_info"],
        ink,
    )
    draw_left_fit(
        draw,
        left_x,
        y_top + int(68 * scale),
        f"编号: {data.line_code}",
        cn_font,
        max(21, int(26 * scale)),
        13,
        layout["max_width"]["left_info"],
        soft_ink,
    )
    draw_left_fit(
        draw,
        left_x,
        y_top + int(94 * scale),
        f"系别: {data.line_family}",
        cn_font,
        max(21, int(26 * scale)),
        13,
        layout["max_width"]["left_info"],
        soft_ink,
    )

    draw.text((right_x, y_top), "母系 (Dam):", font=section_label_font, fill=ink)
    draw_left_fit(
        draw,
        right_x,
        y_top + int(32 * scale),
        data.dam_name,
        cn_font,
        max(28, int(40 * scale)),
        18,
        layout["max_width"]["right_info"],
        ink,
    )
    draw_left_fit(
        draw,
        right_x,
        y_top + int(68 * scale),
        f"编号: {data.dam_code}",
        cn_font,
        max(21, int(26 * scale)),
        13,
        layout["max_width"]["right_info"],
        soft_ink,
    )
    draw_left_fit(
        draw,
        right_x,
        y_top + int(94 * scale),
        f"系别: {data.dam_family}",
        cn_font,
        max(21, int(26 * scale)),
        13,
        layout["max_width"]["right_info"],
        soft_ink,
    )

    left_mid_x, y_mid = layout["ancestor_left_origin"]
    right_mid_x, _ = layout["ancestor_right_origin"]
    draw.text((left_x, y_mid), "祖代信息", font=section_label_font, fill=ink)
    draw_left_fit(
        draw,
        left_mid_x,
        y_mid + int(38 * scale),
        f"祖父 (Sire's Sire): {data.sire_sire}",
        cn_font,
        max(18, int(22 * scale)),
        13,
        layout["max_width"]["ancestor_left"],
        soft_ink,
    )
    draw_left_fit(
        draw,
        left_mid_x,
        y_mid + int(66 * scale),
        f"祖母 (Sire's Dam): {data.sire_dam}",
        cn_font,
        max(18, int(22 * scale)),
        13,
        layout["max_width"]["ancestor_left"],
        soft_ink,
    )

    draw_left_fit(
        draw,
        right_mid_x,
        y_mid + int(38 * scale),
        f"外祖父 (Dam's Sire): {data.dam_sire}",
        cn_font,
        max(18, int(22 * scale)),
        13,
        layout["max_width"]["ancestor_right"],
        soft_ink,
    )
    draw_left_fit(
        draw,
        right_mid_x,
        y_mid + int(66 * scale),
        f"外祖母 (Dam's Dam): {data.dam_dam}",
        cn_font,
        max(18, int(22 * scale)),
        13,
        layout["max_width"]["ancestor_right"],
        soft_ink,
    )

    parent_left_x, y_bottom = layout["parent_left_origin"]
    parent_right_x, _ = layout["parent_right_origin"]
    stamp_x, stamp_y = layout["stamp_center"]
    draw_stamp(draw, stamp_x, stamp_y, scale)

    draw_left_fit(
        draw,
        parent_left_x,
        y_bottom,
        f"父系 (Sire): {data.sire}",
        cn_font,
        max(20, int(24 * scale)),
        14,
        layout["max_width"]["parent_left"],
        ink,
    )
    draw_left_fit(
        draw,
        parent_left_x,
        y_bottom + int(30 * scale),
        f"父祖母 (Sire's Dam): {data.sire_dam}",
        cn_font,
        max(20, int(24 * scale)),
        14,
        layout["max_width"]["parent_left"],
        ink,
    )

    draw_left_fit(
        draw,
        parent_right_x,
        y_bottom,
        f"母系 (Dam): {data.dam}",
        cn_font,
        max(20, int(24 * scale)),
        14,
        layout["max_width"]["parent_right"],
        ink,
    )
    draw_left_fit(
        draw,
        parent_right_x,
        y_bottom + int(30 * scale),
        f"外祖母 (Dam's Dam): {data.dam_dam}",
        cn_font,
        max(20, int(24 * scale)),
        14,
        layout["max_width"]["parent_right"],
        ink,
    )

    qr_box = layout["qr_box"]
    qr_size = max(1, qr_box[2] - qr_box[0])
    qr = draw_fake_qr(f"{data.verify_url}|{data.verify_id}", size=qr_size)
    image.paste(qr, (qr_box[0], qr_box[1]))

    if not has_static_template:
        draw_center_in_box(
            draw,
            qr_box,
            layout["footer"]["qr_title_y"],
            "Scan to Verify Authenticity",
            en_font(max(14, int(18 * scale))),
            ink,
        )
        draw_center_in_box(
            draw,
            qr_box,
            layout["footer"]["qr_id_y"],
            f"Verification ID: {data.verify_id}",
            en_font(max(13, int(16 * scale))),
            ink,
        )
    else:
        draw_center_in_box(
            draw,
            qr_box,
            qr_box[3] + int(8 * scale),
            data.verify_id,
            en_font(max(12, int(14 * scale))),
            soft_ink,
        )

    draw.text(layout["signature_origin"], "Hugo Yuan", font=en_font(max(24, int(52 * scale))), fill=ink)

    if not has_static_template:
        draw_center(
            draw,
            width,
            layout["footer"]["en_y"],
            "This certificate certifies that the above turtle is registered under the Breeding Traceability Record.",
            footer_en_font,
            ink,
        )
        draw_center(
            draw,
            width,
            layout["footer"]["zh_y"],
            f"本证书由选育溯源档案签发（数据源：{data.source_label}）。",
            footer_zh_font,
            soft_ink,
        )

    if layout_debug:
        draw_layout_debug(draw, layout)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(output_path, format="PNG")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate certificate preview image.")
    parser.add_argument("--template", type=Path, default=None, help="Path to certificate background template image")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("out/certificate-preview-local-db.png"),
        help="Output PNG path",
    )
    parser.add_argument(
        "--source",
        choices=("local-db", "mock"),
        default="local-db",
        help="Data source. Default: local-db",
    )
    parser.add_argument("--product-code", type=str, default=None, help="Optional product code when source=local-db")
    parser.add_argument("--layout-debug", action="store_true", help="Draw layout anchor guides on output image")
    parser.add_argument(
        "--layout-dump",
        type=Path,
        default=None,
        help="Write resolved pixel layout JSON (after scaling) to file",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    now = datetime.now()

    if args.source == "mock":
        data = build_mock_data(now)
    else:
        payload = load_local_payload(args.product_code)
        data = build_data_from_local_payload(payload, now)

    render_certificate(
        data=data,
        output_path=args.output,
        template_path=args.template,
        layout_debug=args.layout_debug,
        layout_dump_path=args.layout_dump,
    )
    print(f"Generated certificate: {args.output}")
    print(f"Data source: {data.source_label}")


if __name__ == "__main__":
    main()
