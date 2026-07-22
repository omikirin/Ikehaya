#!/usr/bin/env python3
"""入稿前の機械検収。エラーがあれば非0で終了する。

使い方: python3 validate.py <book_dir>
チェック内容: book.yaml 必須項目 / 原稿の量と体裁 / 表紙 / 生成済みEPUBの構造
"""
import re
import sys
import zipfile
from pathlib import Path

import yaml

errors: list[str] = []
warns: list[str] = []


def err(msg): errors.append(msg)
def warn(msg): warns.append(msg)


def main(book_dir: Path) -> int:
    # --- book.yaml ---
    meta_path = book_dir / "book.yaml"
    if not meta_path.is_file():
        err("book.yaml がない")
        meta = {}
    else:
        meta = yaml.safe_load(meta_path.read_text(encoding="utf-8")) or {}

    for key in ("title", "author", "description", "price_jpy"):
        if not meta.get(key):
            err(f"book.yaml: {key} が未設定")
    if meta.get("title", "").startswith("(仮)"):
        err("book.yaml: title が仮のまま")
    kw = meta.get("keywords") or []
    if len(kw) > 7:
        err(f"book.yaml: keywords が {len(kw)} 個 (KDP上限7)")
    if not kw or kw == ["キーワード1"]:
        warn("book.yaml: keywords がテンプレのまま")
    desc = meta.get("description", "") or ""
    if len(desc) < 100:
        warn(f"description が {len(desc)} 字と短い (200字以上推奨)")

    # --- 原稿 ---
    chapters = sorted((book_dir / "manuscript").glob("*.md"))
    if not chapters:
        err("manuscript/ に原稿がない")
    total = 0
    for ch in chapters:
        text = ch.read_text(encoding="utf-8")
        body = re.sub(r"^#.*$", "", text, flags=re.M)
        n = len(re.sub(r"\s", "", body))
        total += n
        if n < 200:
            warn(f"{ch.name}: 本文 {n} 字と極端に短い")
        if not re.search(r"^#\s", text, re.M):
            warn(f"{ch.name}: 見出し(# )がない")
        if "(本文をここに" in text:
            err(f"{ch.name}: テンプレ文言が残っている")
    if total and total < 10000:
        warn(f"総文字数 {total:,} 字 (Kindle書籍としては1万字以上推奨)")
    elif total:
        print(f"総文字数: {total:,} 字 / {len(chapters)} 章")

    # --- 表紙 ---
    cover_rel = meta.get("cover")
    cover = book_dir / cover_rel if cover_rel else None
    if not (cover and cover.is_file()):
        err(f"表紙がない: {cover_rel}")
    else:
        size = cover.stat().st_size
        if size > 50 * 1024 * 1024:
            err(f"表紙 {size // 1024 // 1024}MB (KDP上限50MB)")
        w, h = image_size(cover)
        if w and h:
            if h < 2500 or w < 1000:
                warn(f"表紙 {w}x{h}px (KDP推奨 1600x2560 以上)")
            ratio = h / w
            if not (1.5 <= ratio <= 1.7):
                warn(f"表紙の縦横比 {ratio:.2f} (推奨 1.6 = 1:1.6)")

    # --- EPUB ---
    epub = book_dir.parent.parent / "build" / f"{book_dir.name}.epub"
    if not epub.is_file():
        warn(f"EPUB未生成 ({epub}) — build_epub.py を先に実行")
    else:
        with zipfile.ZipFile(epub) as z:
            names = z.namelist()
            if names[0] != "mimetype":
                err("EPUB: mimetype が先頭にない")
            for req in ("META-INF/container.xml", "OEBPS/content.opf", "OEBPS/nav.xhtml"):
                if req not in names:
                    err(f"EPUB: {req} がない")
            bad = z.testzip()
            if bad:
                err(f"EPUB: 壊れたエントリ {bad}")
        if epub.stat().st_size > 650 * 1024 * 1024:
            err("EPUB: 650MB超 (KDP上限)")
        print(f"EPUB: {epub.name} ({epub.stat().st_size // 1024} KB)")

    # --- 結果 ---
    for w in warns:
        print(f"⚠ {w}")
    for e in errors:
        print(f"✖ {e}")
    if errors:
        print(f"\n検収NG: エラー {len(errors)} 件 / 警告 {len(warns)} 件")
        return 1
    print(f"\n検収OK (警告 {len(warns)} 件)")
    return 0


def image_size(path: Path):
    """JPEG/PNG のピクセルサイズを stdlib のみで読む。読めなければ (0,0)。"""
    data = path.read_bytes()
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")
    if data[:2] == b"\xff\xd8":  # JPEG
        i = 2
        while i < len(data) - 9:
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            if marker in (0xC0, 0xC1, 0xC2, 0xC3):
                return int.from_bytes(data[i + 7:i + 9], "big"), int.from_bytes(data[i + 5:i + 7], "big")
            i += 2 + int.from_bytes(data[i + 2:i + 4], "big")
    return 0, 0


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1])))
