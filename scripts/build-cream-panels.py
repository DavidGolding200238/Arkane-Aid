"""Cream versions of the parchment panel art (frame PNG + fill JPEG, 3x).

The paper is blended toward #FFF6E2 by up to 60%, ramped in by brightness so the dark
outline, the torn edge and the ink stroke (anything darker than ~100/255) keep their exact
pixels. Alpha is copied untouched. Usage: python scripts/build-cream-panels.py
"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / "assets/images/panels"  # output (shipped)
ART = Path(__file__).resolve().parent.parent / "art-source/panels"  # tan source art (not shipped)
TARGET = np.array([255, 246, 226], np.float32)  # #FFF6E2
STRENGTH = 0.6
LO, HI = 100.0, 162.0  # brightness ramp: untouched below LO, full strength above HI


def cream(rgb: np.ndarray) -> np.ndarray:
    lum = rgb.mean(-1, keepdims=True)
    t = STRENGTH * np.clip((lum - LO) / (HI - LO), 0, 1)
    return np.clip(rgb + t * (TARGET - rgb), 0, 255).round().astype(np.uint8)


def run(name: str) -> None:
    frame = np.array(Image.open(ART / f"{name}-frame@3x.png").convert("RGBA")).astype(np.float32)
    out = frame.copy()
    out[..., :3] = cream(frame[..., :3])
    Image.fromarray(out.astype(np.uint8), "RGBA").save(ROOT / f"{name}-cream-frame@3x.png", optimize=True)
    fill = np.array(Image.open(ART / f"{name}-fill@3x.jpg").convert("RGB")).astype(np.float32)
    Image.fromarray(cream(fill), "RGB").save(ROOT / f"{name}-cream-fill@3x.jpg", quality=88, optimize=True)
    print("wrote", name)


if __name__ == "__main__":
    import sys
    # Pass the panel names to build, e.g. panel-ledger. Nothing is rebuilt by default, so the
    # cream art in use (the Codex book, Ledger, Tome sections and Sage box) stays pixel-identical.
    if len(sys.argv) < 2:
        sys.exit("usage: build-cream-panels.py <panel-name> [...]  (e.g. panel-ledger)")
    for n in sys.argv[1:]:
        run(n)
