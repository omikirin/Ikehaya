#!/usr/bin/env python3
"""編集部ダッシュボード: editorial/reports/*.md を集計して査読状況を一覧表示する。

使い方: python3 editorial_status.py [--md]
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def parse(p: Path) -> dict:
    t = p.read_text(encoding="utf-8")
    def g(pat, default=""):
        m = re.search(pat, t)
        return m.group(1).strip() if m else default
    return {
        "slug": p.stem,
        "verdict": g(r"判定[::]\s*(.+)"),
        "score": g(r"合計[::]\s*([\d/ ]+\S*)"),
        "round": g(r"査読回[::]\s*(\d+)", "1"),
        "p1_open": len(re.findall(r"^\s*-\s*\[P1\]", t, re.M)),
        "revised": "改稿記録" in t,
    }


def main():
    reports = sorted((ROOT / "editorial" / "reports").glob("*.md"))
    books = sorted(d.name for d in (ROOT / "books").iterdir() if d.is_dir() and d.name != "_template")
    rows = [parse(p) for p in reports]
    done = {r["slug"] for r in rows}
    md = "--md" in sys.argv

    if md:
        print("| 書籍 | 判定 | スコア | 査読回 | P1指摘 | 改稿 |")
        print("|---|---|---|---|---|---|")
        for r in rows:
            print(f"| {r['slug']} | {r['verdict']} | {r['score']} | {r['round']} | {r['p1_open']} | {'済' if r['revised'] else '-'} |")
    else:
        for r in rows:
            print(f"{r['slug']:24s} {r['verdict']:12s} {r['score']:20s} 査読{r['round']}回 P1:{r['p1_open']} 改稿:{'済' if r['revised'] else '-'}")

    go = sum(1 for r in rows if r["verdict"].startswith("GO"))
    cond = sum(1 for r in rows if r["verdict"].startswith("条件付き"))
    ng = sum(1 for r in rows if r["verdict"] == "NG")
    print(f"\n査読済 {len(rows)}/{len(books)} | GO {go} / 条件付きGO {cond} / NG {ng} | 未査読 {len(books) - len(done)}")
    if len(done) < len(books):
        pending = [b for b in books if b not in done]
        print("未査読:", ", ".join(pending[:10]) + (" ほか" if len(pending) > 10 else ""))


if __name__ == "__main__":
    main()
