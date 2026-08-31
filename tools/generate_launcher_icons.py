#!/usr/bin/env python3
"""Rasterise the ClubCarder mark into the legacy launcher PNGs.

Adaptive icons (API 26+) are drawn from the vector in
`res/drawable/ic_launcher_foreground.xml`, so this script only exists to cover
API 24-25, which still read `mipmap-*/ic_launcher.png`. Written against the
standard library alone because the machine has no SVG rasteriser installed.

Run from anywhere:  python3 tools/generate_launcher_icons.py
"""

from __future__ import annotations

import math
import pathlib
import struct
import zlib

BROWN = (0x5B, 0x37, 0x17)
WHITE = (0xFF, 0xFF, 0xFF)

# Densities for the square and round legacy launcher icons.
LAUNCHER_SIZES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}
# The adaptive foreground fallback keeps the platform's 108-unit proportions.
FOREGROUND_SIZES = {name: round(size * 108 / 48) for name, size in LAUNCHER_SIZES.items()}

SUPERSAMPLE = 4


def rounded_box_distance(x: float, y: float, cx: float, cy: float, half: float, radius: float) -> float:
    """Signed distance to a rounded square: negative inside, positive outside."""
    dx = abs(x - cx) - (half - radius)
    dy = abs(y - cy) - (half - radius)
    outside = math.hypot(max(dx, 0.0), max(dy, 0.0))
    return outside + min(max(dx, dy), 0.0) - radius


def in_arc(x: float, y: float, cx: float, cy: float, radius: float, width: float, gap_deg: float) -> bool:
    """A stroked circular arc with a wedge removed, facing +x."""
    dx, dy = x - cx, y - cy
    if abs(math.hypot(dx, dy) - radius) > width / 2:
        return False
    return abs(math.degrees(math.atan2(dy, dx))) > gap_deg


def in_sparkle(x: float, y: float, cx: float, cy: float, reach: float) -> bool:
    """A four-point star, as an astroid: |x|^(2/3) + |y|^(2/3) <= r^(2/3)."""
    dx, dy = abs(x - cx) / reach, abs(y - cy) / reach
    if dx > 1 or dy > 1:
        return False
    return dx ** (2 / 3) + dy ** (2 / 3) <= 1.0


def coverage(u: float, v: float) -> tuple[bool, bool]:
    """Sample the 64-unit artwork. Returns (is_ink, is_inside_frame)."""
    frame = rounded_box_distance(u, v, 32, 32, 22, 12)
    ink = abs(frame) <= 2.5
    ink = ink or in_arc(u, v, 29, 32, 13.5, 4.4, 42)
    ink = ink or in_arc(u, v, 29, 32, 7.5, 4.4, 42)
    ink = ink or in_sparkle(u, v, 46, 20, 9)
    return ink, frame <= 0


def render(size: int, art_fraction: float, fill_frame: bool) -> bytes:
    """Render to raw RGBA rows, supersampled for smooth edges."""
    scale = size * art_fraction / 48.0  # the mark occupies units 8..56
    offset = size / 2.0 - 32.0 * scale
    step = 1.0 / SUPERSAMPLE
    samples = SUPERSAMPLE * SUPERSAMPLE

    rows = bytearray()
    for py in range(size):
        rows.append(0)  # PNG per-row filter byte: none
        for px in range(size):
            ink_hits = 0
            frame_hits = 0
            for sy in range(SUPERSAMPLE):
                for sx in range(SUPERSAMPLE):
                    u = (px + (sx + 0.5) * step - offset) / scale
                    v = (py + (sy + 0.5) * step - offset) / scale
                    ink, inside = coverage(u, v)
                    ink_hits += ink
                    frame_hits += inside
            ink_a = ink_hits / samples
            base_a = (frame_hits / samples) if fill_frame else 0.0
            alpha = max(ink_a, base_a)
            if alpha == 0:
                rows.extend((0, 0, 0, 0))
                continue
            # Composite brown ink over the white frame fill.
            mix = ink_a / alpha
            rgb = tuple(
                round(BROWN[i] * mix + WHITE[i] * (1 - mix)) for i in range(3)
            )
            rows.extend((*rgb, round(alpha * 255)))
    return bytes(rows)


def write_png(path: pathlib.Path, size: int, raw: bytes) -> None:
    def chunk(tag: bytes, data: bytes) -> bytes:
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    header = struct.pack(">2I5B", size, size, 8, 6, 0, 0, 0)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def main() -> None:
    res = pathlib.Path(__file__).resolve().parents[1] / "android/app/src/main/res"
    for density, size in LAUNCHER_SIZES.items():
        raw = render(size, art_fraction=0.90, fill_frame=True)
        for name in ("ic_launcher.png", "ic_launcher_round.png"):
            write_png(res / f"mipmap-{density}" / name, size, raw)
        print(f"mipmap-{density}: {size}x{size}")

    for density, size in FOREGROUND_SIZES.items():
        raw = render(size, art_fraction=60 / 108, fill_frame=False)
        write_png(res / f"mipmap-{density}/ic_launcher_foreground.png", size, raw)


if __name__ == "__main__":
    main()
