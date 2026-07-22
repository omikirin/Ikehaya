#!/usr/bin/env python3
"""manuscript/*.md と book.yaml から EPUB3 を生成する。

使い方: python3 build_epub.py <book_dir> [-o out.epub]
依存: Python 標準ライブラリ + PyYAML
"""
import argparse
import html
import re
import sys
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import yaml


def md_to_html(md: str) -> str:
    """縦書き日本語書籍で使う範囲の最小 Markdown → XHTML 変換。"""

    def inline(s: str) -> str:
        s = html.escape(s, quote=False)
        s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
        s = re.sub(r"\*(.+?)\*", r"<em>\1</em>", s)
        s = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", r'<img alt="\1" src="\2"/>', s)
        s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', s)
        return s

    out, para, in_list, in_quote = [], [], False, False

    def flush_para():
        if para:
            out.append("<p>" + "<br/>".join(inline(l) for l in para) + "</p>")
            para.clear()

    def close_blocks():
        nonlocal in_list, in_quote
        flush_para()
        if in_list:
            out.append("</ul>")
            in_list = False
        if in_quote:
            out.append("</blockquote>")
            in_quote = False

    for line in md.splitlines():
        stripped = line.strip()
        m = re.match(r"^(#{1,6})\s+(.*)", stripped)
        if m:
            close_blocks()
            n = len(m.group(1))
            out.append(f"<h{n}>{inline(m.group(2))}</h{n}>")
        elif stripped.startswith(("- ", "* ")):
            flush_para()
            if not in_list:
                out.append("<ul>")
                in_list = True
            out.append(f"<li>{inline(stripped[2:])}</li>")
        elif stripped.startswith("> "):
            flush_para()
            if not in_quote:
                out.append("<blockquote>")
                in_quote = True
            out.append(f"<p>{inline(stripped[2:])}</p>")
        elif stripped == "":
            close_blocks()
        else:
            if in_list or in_quote:
                close_blocks()
            para.append(stripped)
    close_blocks()
    return "\n".join(out)


CSS = """\
html { -epub-writing-mode: vertical-rl; writing-mode: vertical-rl; }
body { font-family: serif; line-height: 1.8; margin: 0; padding: 1em; }
h1 { font-size: 1.5em; margin: 0 0 2em 1em; }
h2 { font-size: 1.2em; margin: 0 0 1.5em 0.5em; }
p { margin: 0; text-indent: 1em; }
blockquote { margin: 1em; opacity: 0.85; }
img { max-width: 100%; max-height: 100%; }
"""

XHTML = """<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="{lang}">
<head><title>{title}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>{body}</body>
</html>
"""


def chapter_title(path: Path, body_md: str) -> str:
    m = re.search(r"^#\s+(.+)$", body_md, re.M)
    return m.group(1).strip() if m else path.stem


def build(book_dir: Path, out_path: Path) -> None:
    meta = yaml.safe_load((book_dir / "book.yaml").read_text(encoding="utf-8"))
    chapters = sorted((book_dir / "manuscript").glob("*.md"))
    if not chapters:
        sys.exit("manuscript/ に .md がありません")

    title = meta["title"]
    author = meta.get("author", "")
    lang = meta.get("language", "ja")
    book_id = f"urn:uuid:{uuid.uuid5(uuid.NAMESPACE_URL, title + author)}"
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    cover_rel = meta.get("cover", "")
    cover_path = book_dir / cover_rel if cover_rel else None
    has_cover = bool(cover_path and cover_path.is_file())

    items, spine, nav_lis = [], [], []
    files: list[tuple[str, bytes]] = []

    if has_cover:
        ext = cover_path.suffix.lower().lstrip(".")
        mime = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
        files.append((f"OEBPS/cover.{ext}", cover_path.read_bytes()))
        items.append(f'<item id="cover-img" href="cover.{ext}" media-type="{mime}" properties="cover-image"/>')
        cover_html = XHTML.format(lang=lang, title="表紙", body=f'<div style="text-align:center"><img src="cover.{ext}" alt="cover"/></div>')
        files.append(("OEBPS/cover.xhtml", cover_html.encode()))
        items.append('<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>')
        spine.append('<itemref idref="cover" linear="yes"/>')

    for i, ch in enumerate(chapters):
        md = ch.read_text(encoding="utf-8")
        name = f"ch{i:03d}.xhtml"
        ctitle = chapter_title(ch, md)
        files.append((f"OEBPS/{name}", XHTML.format(lang=lang, title=html.escape(ctitle), body=md_to_html(md)).encode()))
        items.append(f'<item id="ch{i:03d}" href="{name}" media-type="application/xhtml+xml"/>')
        spine.append(f'<itemref idref="ch{i:03d}"/>')
        nav_lis.append(f'<li><a href="{name}">{html.escape(ctitle)}</a></li>')

    nav = XHTML.format(lang=lang, title="目次", body=(
        '<nav epub:type="toc" id="toc"><h1>目次</h1><ol>' + "".join(nav_lis) + "</ol></nav>"))
    files.append(("OEBPS/nav.xhtml", nav.encode()))
    files.append(("OEBPS/style.css", CSS.encode()))

    opf = f"""<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bid"
         prefix="rendition: http://www.idpf.org/vocab/rendition/#">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:identifier id="bid">{book_id}</dc:identifier>
  <dc:title>{html.escape(title)}</dc:title>
  <dc:creator>{html.escape(author)}</dc:creator>
  <dc:language>{lang}</dc:language>
  <dc:publisher>{html.escape(meta.get("publisher", ""))}</dc:publisher>
  <meta property="dcterms:modified">{now}</meta>
  <meta property="rendition:orientation">auto</meta>
  <meta property="rendition:spread">auto</meta>
</metadata>
<manifest>
  <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  <item id="css" href="style.css" media-type="text/css"/>
  {chr(10).join(items)}
</manifest>
<spine page-progression-direction="rtl">
  {chr(10).join(spine)}
</spine>
</package>
"""
    container = """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>
"""

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out_path, "w") as z:
        z.writestr(zipfile.ZipInfo("mimetype"), "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        z.writestr("META-INF/container.xml", container)
        z.writestr("OEBPS/content.opf", opf)
        for name, data in files:
            z.writestr(name, data)
    print(f"OK: {out_path} ({out_path.stat().st_size // 1024} KB, {len(chapters)} 章, 表紙={'あり' if has_cover else 'なし'})")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("book_dir", type=Path)
    ap.add_argument("-o", "--out", type=Path)
    a = ap.parse_args()
    out = a.out or (a.book_dir.parent.parent / "build" / f"{a.book_dir.name}.epub")
    build(a.book_dir, out)
