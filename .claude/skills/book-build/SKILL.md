---
name: book-build
description: 出版パイプラインの制作フェーズ。EPUB生成・表紙準備・機械検収を行い入稿可能な状態にする。「EPUBを作って」「本をビルドして」「入稿データを作って」で使用。/book-edit の次工程。
---

# /book-build — EPUB生成と検収

## 手順

対象 `publishing/books/<slug>/`。

1. **表紙確認**: `cover/cover.jpg` があるか確認。なければ:
   - ユーザー提供画像があればリサイズして配置(推奨 1600x2560、1:1.6)
   - なければ表紙のデザイン指示書(タイトル配置・配色・モチーフ)を `cover/cover_brief.md` に書き、外注/Canva用にユーザーへ渡す。表紙なしでもビルドは続行。
2. **EPUB生成**:
   ```bash
   python3 publishing/scripts/build_epub.py publishing/books/<slug>
   ```
3. **機械検収**:
   ```bash
   python3 publishing/scripts/validate.py publishing/books/<slug>
   ```
   エラーが出たら原因を直して再ビルド。エラー0まで繰り返す。
4. **報告**: EPUBパス・サイズ・章数・警告一覧と、残る手動確認(Kindle Previewerでの目視)を伝え、`publishing/checklists/kdp_checklist.md` と /book-launch を案内する。

## 注意
- 検収エラーを残したまま完了報告しない。
- 生成物は `publishing/build/` に置く(git管理外)。EPUBはコミットしない。
