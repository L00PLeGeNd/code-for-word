"""Assemble docs/demo.gif from app frames + real Word paste frames."""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FRAME_DIR = ROOT / "docs" / "_demo-frames"
OUT = ROOT / "docs" / "demo.gif"
TARGET_W = 1440
TARGET_H = 900

# Real Word shots from capture-word-demo.ps1
WORD_SHOTS = [
    ("word-00.png", 800),   # empty Word
    ("word-01.png", 900),   # ready + Ctrl+V badge (drawn below)
    ("word-02.png", 1100),  # pasted
    ("word-03.png", 1400),  # hold
]


def draw_ctrl_v_badge(im: Image.Image) -> Image.Image:
    """Subtle Ctrl+V hint on the empty Word frame — not a fake Word chrome."""
    out = im.copy()
    draw = ImageDraw.Draw(out, "RGBA")
    label = "Ctrl + V"
    try:
        font = ImageFont.truetype("segoeui.ttf", 28)
    except OSError:
        try:
            font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 28)
        except OSError:
            font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), label, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pad_x, pad_y = 22, 14
    bw, bh = tw + pad_x * 2, th + pad_y * 2
    x = (out.width - bw) // 2
    y = out.height - bh - 96
    draw.rounded_rectangle(
        (x, y, x + bw, y + bh),
        radius=14,
        fill=(22, 24, 29, 210),
    )
    draw.text((x + pad_x, y + pad_y - 2), label, fill=(255, 255, 255, 255), font=font)
    return out.convert("RGB")


def load_rgb(path: Path, *, badge: bool = False) -> Image.Image:
    im = Image.open(path).convert("RGB")
    if im.size != (TARGET_W, TARGET_H):
        # Letterbox into 1440×900
        canvas = Image.new("RGB", (TARGET_W, TARGET_H), (230, 230, 230))
        w, h = im.size
        scale = min(TARGET_W / w, TARGET_H / h)
        nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
        im = im.resize((nw, nh), Image.Resampling.LANCZOS)
        canvas.paste(im, ((TARGET_W - nw) // 2, (TARGET_H - nh) // 2))
        im = canvas
    if badge:
        im = draw_ctrl_v_badge(im)
    return im


def main() -> None:
    meta_path = FRAME_DIR / "meta.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    entries = list(meta["meta"])

    rgb_frames: list[Image.Image] = []
    durations: list[int] = []

    for e in entries:
        path = FRAME_DIR / Path(e["file"]).name
        rgb_frames.append(load_rgb(path))
        durations.append(int(e.get("holdMs", 120)))

    for name, hold in WORD_SHOTS:
        path = FRAME_DIR / name
        if not path.exists():
            raise SystemExit(
                f"Missing {path.name}. Run:\n"
                f"  node scripts/export-demo-rtf.mjs\n"
                f"  powershell -File scripts/capture-word-demo.ps1"
            )
        rgb_frames.append(load_rgb(path, badge=(name == "word-01.png")))
        durations.append(hold)

    strip_h = sum(im.height for im in rgb_frames)
    strip = Image.new("RGB", (TARGET_W, strip_h))
    y = 0
    for im in rgb_frames:
        strip.paste(im, (0, y))
        y += im.height
    pw = 640
    ph = max(1, round(strip.height * pw / strip.width))
    pal = strip.resize((pw, ph), Image.Resampling.BOX).quantize(
        colors=256, method=Image.Quantize.MEDIANCUT
    )
    frames = [im.quantize(palette=pal, dither=Image.Dither.NONE) for im in rgb_frames]

    frames[0].save(
        OUT,
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        optimize=True,
        disposal=2,
    )
    kb = OUT.stat().st_size / 1024
    print(f"wrote {OUT} ({kb:.1f} KB, {len(frames)} frames, {frames[0].size})")


if __name__ == "__main__":
    main()
