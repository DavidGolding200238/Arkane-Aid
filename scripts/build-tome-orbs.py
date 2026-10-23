"""Tome voice-picker orbs: one disc per voice plus one shared soft drop shadow.

The old picker art had the Figma drop shadow baked into a 638 px export that was narrower
than the shadow itself, so the shadow ended in hard straight edges. Here the disc is cut
out of the Figma orb export (art-source/tome/orb-*.png, orb on a cream backdrop) with an
antialiased mask, and the shadow is rebuilt on a canvas wide enough for it to fade to zero.

Shadow model, fitted to the Figma export (RMS error ~1%): the disc grown by 30 px, moved
8 px down, Gaussian blur sigma 36 px, opacity 0.977 (all in orb-export pixels, R = 293).

Units: "picker px" = the old 638 x 685 @3x picker canvas, which VoiceCarousel still uses
for layout (orb centre 320, 323.5). Usage: python scripts/build-tome-orbs.py
Needs numpy, Pillow, opencv-python-headless and imagequant (all free, pip).
"""
from pathlib import Path
import cv2
import imagequant
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent.parent
ART = HERE / "art-source/tome"
OUT = HERE / "assets/images/tome"
SRC = {"wizard": "orb-red.png", "plain": "orb-blue.png", "bard": "orb-green.png"}

CX, CY = 362.0, 412.0  # orb centre in the export
RIM = 297.5  # outer edge of the rim stroke in the export
SCALE = 0.884  # export px -> picker px (the old composite used this)
DISC = 2 * round(RIM * SCALE)  # 526 picker px

# shadow, picker px
R_IN = 293 * SCALE
SPREAD, OFFSET, SIGMA, OPACITY = 30 * SCALE, 8 * SCALE, 36 * SCALE, 0.977
SHADOW = 840  # canvas side, picker px (fades below 1/255 well inside it)
SHADOW_DOWN = 4  # the shadow is smooth, so it ships at 1/4 resolution and is stretched


def disc(name: str) -> Image.Image:
    src = Image.open(ART / SRC[name]).convert("RGB")
    s = RIM * 2
    crop = src.crop((CX - RIM, CY - RIM, CX + RIM, CY + RIM)).resize((DISC, DISC), Image.LANCZOS, box=(0, 0, s, s))
    yy, xx = np.mgrid[0:DISC, 0:DISC] + 0.5
    d = np.hypot(xx - DISC / 2, yy - DISC / 2)
    a = np.clip(DISC / 2 - d + 0.5, 0, 1)  # 1 px antialiased edge
    rgba = np.dstack([np.asarray(crop), (a * 255).round().astype(np.uint8)])
    return Image.fromarray(rgba, "RGBA")


def shadow() -> Image.Image:
    up = 4  # supersample the disc edge
    can = np.zeros((SHADOW, SHADOW), np.float32)
    c = SHADOW / 2
    cv2.circle(can, (round(c * up * 4), round(c * up * 4)), round((R_IN + SPREAD) * up * 4), 1.0, -1, cv2.LINE_AA, 4)
    a = OPACITY * cv2.GaussianBlur(can, (0, 0), SIGMA)
    n = SHADOW // SHADOW_DOWN
    a = cv2.resize(a, (n, n), interpolation=cv2.INTER_AREA)
    rgba = np.zeros((n, n, 4), np.uint8)
    rgba[..., 3] = (a * 255).round().clip(0, 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def save(img: Image.Image, path: Path) -> None:
    q = imagequant.quantize_pil_image(img, dithering_level=1.0, max_colors=256, min_quality=90)
    q.save(path, optimize=True)
    try:
        import oxipng
        oxipng.optimize(path, level=4)
    except ImportError:
        pass
    print(path.relative_to(HERE), path.stat().st_size, "B")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name in SRC:
        save(disc(name), OUT / f"voice-orb-{name}@3x.png")
    save(shadow(), OUT / "orb-shadow.png")
    print("shadow centre offset (picker px):", OFFSET)
