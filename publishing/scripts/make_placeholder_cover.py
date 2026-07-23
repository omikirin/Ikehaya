#!/usr/bin/env python3
"""仮表紙PNG(1600x2560)を生成する。本番表紙が用意できるまでの検収用プレースホルダー。

使い方: python3 make_placeholder_cover.py <out.png> [r,g,b] [r2,g2,b2]
縦方向グラデーションの単純な表紙。色は 0-255 のRGB。
"""
import struct
import sys
import zlib


def chunk(t: bytes, d: bytes) -> bytes:
    c = t + d
    return struct.pack(">I", len(d)) + c + struct.pack(">I", zlib.crc32(c))


def main():
    out = sys.argv[1]
    top = tuple(int(x) for x in (sys.argv[2] if len(sys.argv) > 2 else "20,16,40").split(","))
    bot = tuple(int(x) for x in (sys.argv[3] if len(sys.argv) > 3 else "120,30,30").split(","))
    w, h = 1600, 2560
    rows = []
    for y in range(h):
        t = y / (h - 1)
        r, g, b = (round(a + (b2 - a) * t) for a, b2 in zip(top, bot))
        rows.append(b"\x00" + bytes((r, g, b)) * w)
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(b"".join(rows), 6))
           + chunk(b"IEND", b""))
    with open(out, "wb") as f:
        f.write(png)
    print(f"OK: {out} ({w}x{h})")


if __name__ == "__main__":
    main()
