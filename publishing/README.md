# 出版社パイプライン (Book Factory)

ひとり出版社の「企画 → 執筆 → 校正 → EPUB/表紙 → 入稿チェック → 販促」を
Claude スキル + スクリプトで一気通貫に回すためのパイプライン。

## 全体フロー

```
/book-plan   企画・タイトル案・章構成 → books/<slug>/book.yaml + outline.md
/book-write  章ごとの原稿執筆        → books/<slug>/manuscript/NN_*.md
/book-edit   校正・推敲・表記統一     → 原稿を直接修正 + 校正レポート
/book-build  EPUB生成 + 機械検収     → build/<slug>.epub + 検収レポート
/editor-review 編集査読(採点+改稿指示+判定) → editorial/reports/<slug>.md
/editor-fix    改稿+再検収              → 原稿更新+改稿記録
/book-launch KDP入稿手順 + 販促素材   → 入稿チェックリスト・告知文・LP骨子
```

編集部の基準は `publishing/editorial/RUBRIC.md`。査読状況の一覧は
`python3 publishing/scripts/editorial_status.py` で確認できる。
判定がGO(または条件消化)になるまで /book-launch に進まない。

各スキルは `.claude/skills/` にあり、Claude Code 上で `/book-plan` のように呼ぶ。

### 小説モード: /ninja-novel

CryptoNinja 二次創作小説は `/ninja-novel` が入口。ジャンルと主役キャラを選ぶと、
NINJAMCP から設定・世界観・公式画像(CC0)を取得して `books/<slug>/lore/` に固め、
上記パイプラインをフィクション仕様(だ・である調、三幕プロット、話数割り)で回し、
販促は軍配(pro-marketing-director)で検収する。

## ディレクトリ構成

```
publishing/
  books/
    _template/          新刊のひな形。コピーして books/<slug>/ を作る
      book.yaml         書誌メタ(タイトル・著者・価格・カテゴリ等)
      outline.md        企画書・章構成
      manuscript/       章ごとの Markdown 原稿 (00_intro.md, 01_xxx.md ...)
      cover/            表紙画像 (cover.jpg, 1600x2560 推奨)
  scripts/
    build_epub.py       manuscript/*.md → EPUB3 を生成 (依存: Python標準 + PyYAML)
    validate.py         入稿前の機械検収 (メタ・原稿・表紙・EPUBをチェック)
  checklists/
    kdp_checklist.md    KDP入稿の手動チェックリスト
  build/                生成物 (git管理外)
```

## 新刊を作る手順

1. `cp -r publishing/books/_template publishing/books/<slug>`
2. `/book-plan` で企画を詰め、`book.yaml` と `outline.md` を確定
3. `/book-write` で章を順に執筆
4. `/book-write` 完了後 `/book-edit` で全章校正
5. `python3 publishing/scripts/build_epub.py publishing/books/<slug>` で EPUB 生成
6. `python3 publishing/scripts/validate.py publishing/books/<slug>` で検収
7. `/book-launch` で入稿・販促へ

## コマンド単体での使い方

```bash
# EPUB 生成
python3 publishing/scripts/build_epub.py publishing/books/my-book

# 検収 (EPUB生成後に実行。エラーがあれば非0で終了)
python3 publishing/scripts/validate.py publishing/books/my-book
```
