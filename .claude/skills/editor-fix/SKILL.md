---
name: editor-fix
description: 編集者パイプラインの改稿フェーズ。査読レポートの改稿指示(P1→P2)を原稿・ネームに適用し、再ビルド・検収し、必要なら再査読を依頼する。「改稿して」「指摘を直して」「リテイク対応」で使用。/editor-review の次工程。
---

# /editor-fix — 改稿

対象: `publishing/editorial/reports/<slug>.md` があり判定が NG または条件付きGO の書籍。

## 手順

1. レポートの改稿指示を P1→P2 の順に適用する。P3 は時間対効果で判断し、やらない場合は理由をレポートに追記。
2. 直すのは指示の箇所だけではない — 同種の問題(語尾連続・口調ブレ等)が他話にもあれば横展開して直す。
3. 「良い点」に挙げられた長所を壊していないか、改稿後に該当箇所を読み直す。
4. ネームへの影響確認: 本文を変えた話は name/epNN.md のセリフ・構成も同期させる。
5. 再ビルド+機械検収:
   ```bash
   python3 publishing/scripts/build_epub.py publishing/books/<slug>
   python3 publishing/scripts/validate.py publishing/books/<slug>
   ```
6. レポート末尾に「## 改稿記録(N回目)」を追記: 適用した指示 / 見送った指示と理由 / 横展開した箇所。
7. 判定がNGだった場合は /editor-review で再査読(査読回+1)。条件付きGOは指示消化をもって出版可とし、判定を「GO(条件消化)」に更新する。

## 禁止
- 指示を「対応済み」とだけ書いて実質未対応にすること
- 改稿でRUBRIC違反を新たに作ること(特に公式設定矛盾)
