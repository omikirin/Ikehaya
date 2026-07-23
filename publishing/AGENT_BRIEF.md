# 制作エージェント共通指示書 (CryptoNinja二次創作小説)

与えられた「キャラ」「ジャンル」「slug」「公式画像URL」で、小説一冊を最後まで作り切る。

## 手順(厳守)
1. ToolSearch で "select:mcp__NINJAMCP__get_character,mcp__NINJAMCP__get_worldview,mcp__NINJAMCP__search_lore" をロード。主役と関係キャラの設定、世界観(all)を取得。鍵となる術・武器・関係は search_lore で裏取り。
2. `cp -r /home/user/Ikehaya/publishing/books/_template /home/user/Ikehaya/publishing/books/<slug>` でディレクトリ作成。`lore/characters.md`(公式設定要約+出典)と `lore/original_notes.md`(本作独自解釈の列挙)を書く。
3. `outline.md` をプロットに書き換え: ログライン1行/三幕構成/全6話(各話タイトル・内容・引き1行)/主役の内的変化。公式設定(忍術・武器・血縁・ライバル関係)と矛盾させない。公式キャラを悪役として貶めない(敵が必要なら本作オリジナルの敵を作る。根の国キャラが主役の場合は公式の敵対的立場の範囲で悲哀や業を描く)。
4. `book.yaml` を確定: title(15〜30字)/ subtitle "CryptoNinja二次創作小説" / author "著者名" / publisher "出版社名" / description(あらすじ200字以上+「CryptoNinja二次創作」明記) / keywords(CryptoNinja・クリプトニンジャ含む7つ) / categories 2つ / price_jpy 300 / kdp_select true / cover: cover/cover.png
5. `manuscript/00_intro.md` を削除し、01〜06 の全6話を執筆。1話約2,000〜2,500字。地の文はだ・である調、三人称一元視点(主役固定)。各話「# 第N話 タイトル」で開始。前話の引き回収→山場→次話への引き。戦闘・術は五感+代償を描き、効果を公式より盛らない。性的描写・過度なゴアなし(全年齢)。
6. 表紙: `python3 /home/user/Ikehaya/publishing/scripts/make_placeholder_cover.py /home/user/Ikehaya/publishing/books/<slug>/cover/cover.png R,G,B R2,G2,B2`(ジャンルに合う配色)。`cover/cover_brief.md` に本番表紙指示(構図・タイトル配置・配色・公式画像URL、CC0である旨)。
7. `python3 /home/user/Ikehaya/publishing/scripts/build_epub.py /home/user/Ikehaya/publishing/books/<slug>` → `python3 /home/user/Ikehaya/publishing/scripts/validate.py /home/user/Ikehaya/publishing/books/<slug>` をエラー0まで繰り返す(警告は許容)。
8. 漫画ネーム化: `name/ep01.md`〜`ep06.md`。1話=8〜12ページ。各ページごとに「コマ番号/構図(カメラ・被写体)/セリフ・モノローグ/効果音・演出指示」。見開きの山場と最終ページの引きを明示。
9. git commit/push はしない(親エージェントが行う)。

## 最終報告
返答テキストは次のJSONのみ:
{"slug":"...","title":"...","chars":総文字数,"validate":"OK|NG","warnings":件数,"name_pages":ネーム総ページ数}
