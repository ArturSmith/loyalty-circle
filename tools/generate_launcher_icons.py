#!/usr/bin/env python3
"""Generate every app icon from the master ClubCarder artwork.

Source of truth: `public/club-carder-logo.png` (square, >=1024px).

Outputs
-------
web      public/logo.png, favicon.png, favicon-48.png, favicon-192.png,
         apple-touch-icon.png
android  mipmap-*/ic_launcher.png, ic_launcher_round.png and the adaptive
         foreground mipmap-*/ic_launcher_foreground.png (brand navy is keyed
         out so the launcher's own background colour shows through)
ios      Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png

Requires Pillow:  python3 -m pip install --user pillow
Run from anywhere: python3 tools/generate_launcher_icons.py
"""

from __future__ import annotations

import pathlib
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:  # pragma: no cover - dependency hint
    sys.exit("Pillow is required: python3 -m pip install --user pillow")

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public" / "club-carder-logo.png"

# Flat brand navy used as the artwork backdrop; also the adaptive icon colour.
BRAND_NAVY = (0x02, 0x2E, 0x96)
KEY_TOLERANCE = 70  # colour-key radius in RGB space

LAUNCHER_SIZES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}
# Adaptive icons keep the platform's 108-unit canvas.
FOREGROUND_SIZES = {name: round(size * 108 / 48) for name, size in LAUNCHER_SIZES.items()}
# Fraction of the 108 canvas the artwork may occupy. 66/108 is the strict safe
# zone; the mark already carries padding inside its frame so we go a bit wider.
FOREGROUND_INSET = 76 / 108

WEB_ICONS = {
    "logo.png": 512,
    "favicon.png": 512,
    "favicon-48.png": 48,
    "favicon-192.png": 192,
    "apple-touch-icon.png": 180,
}

ANDROID_RES = ROOT / "android" / "app" / "src" / "main" / "res"
IOS_APPICON = (
    ROOT / "ios" / "App" / "App" / "Assets.xcassets" / "AppIcon.appiconset" / "AppIcon-512@2x.png"
)


def load_source() -> Image.Image:
    if not SOURCE.exists():
        sys.exit(f"missing source artwork: {SOURCE}")
    img = Image.open(SOURCE).convert("RGBA")
    if img.width != img.height:
        side = min(img.size)
        left = (img.width - side) // 2
        top = (img.height - side) // 2
        img = img.crop((left, top, left + side, top + side))
    return img


def key_out_navy(img: Image.Image) -> Image.Image:
    """Return the artwork with the navy backdrop turned transparent."""
    out = img.copy()
    px = out.load()
    br, bg, bb = BRAND_NAVY
    limit = KEY_TOLERANCE * KEY_TOLERANCE
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if (r - br) ** 2 + (g - bg) ** 2 + (b - bb) ** 2 <= limit:
                px[x, y] = (r, g, b, 0)
    return out


def resized(img: Image.Image, size: int) -> Image.Image:
    return img.resize((size, size), Image.LANCZOS)


def write(img: Image.Image, path: pathlib.Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")
    print(f"wrote {path.relative_to(ROOT)}  {img.width}x{img.height}")


def circular(img: Image.Image) -> Image.Image:
    """Legacy round launcher icon: the square artwork clipped to a circle."""
    scale = 4
    mask = Image.new("L", (img.width * scale, img.height * scale), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, mask.width - 1, mask.height - 1), fill=255)
    mask = mask.resize(img.size, Image.LANCZOS)
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def foreground(mark: Image.Image, size: int) -> Image.Image:
    """Centre the keyed-out mark on a transparent adaptive-icon canvas."""
    art = round(size * FOREGROUND_INSET)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    offset = (size - art) // 2
    canvas.paste(resized(mark, art), (offset, offset))
    return canvas


def main() -> None:
    source = load_source()
    mark = key_out_navy(source)

    for name, size in WEB_ICONS.items():
        write(resized(source, size), ROOT / "public" / name)

    write(resized(source, 1024), IOS_APPICON)

    for density, size in LAUNCHER_SIZES.items():
        square = resized(source, size)
        write(square, ANDROID_RES / f"mipmap-{density}" / "ic_launcher.png")
        write(circular(square), ANDROID_RES / f"mipmap-{density}" / "ic_launcher_round.png")

    for density, size in FOREGROUND_SIZES.items():
        write(foreground(mark, size), ANDROID_RES / f"mipmap-{density}" / "ic_launcher_foreground.png")


if __name__ == "__main__":
    main()
