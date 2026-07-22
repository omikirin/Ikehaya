---
name: book-launch
description: 出版パイプラインの発売フェーズ。KDP入稿の手引きと販促素材(告知文・X投稿・LP骨子・ショート動画連携)を作る。「入稿したい」「発売準備」「本の告知を作って」で使用。/book-build の次工程。
---

# /book-launch — 入稿・販促

## 手順

対象 `publishing/books/<slug>/`。検収済みEPUBがあることを確認(なければ /book-build へ)。

### 1. 入稿ガイド
`publishing/checklists/kdp_checklist.md` を提示し、book.yaml の内容から KDP入力欄への貼り付け用テキスト(タイトル/説明文HTML/キーワード7つ/価格)を `launch/kdp_input.md` にまとめる。

### 2. 販促素材を `launch/` に生成
- `announce_x.md` — X告知文3パターン(発売告知/読者ベネフィット訴求/実績・裏話)+ 発売週の投稿スケジュール案
- `lp_outline.md` — LP/noteでの紹介記事骨子(悩み→約束→目次チラ見せ→著者→CTA)
- `video_brief.md` — 書籍の核となる主張3つをショート動画のフック案に落とす(制作は short-video-maker スキルで別途実行)

### 3. マーケ連携
販促の設計・検収は pro-marketing-director スキル(軍配)の基準に従う。大きな販促計画が必要ならそちらを起動する。

## 注意
- KDP入稿自体はユーザーの手作業(アカウント操作は代行しない)。貼るだけで済む状態まで準備するのがゴール。
- 誇大表現(「必ず儲かる」等)は告知文に入れない。
