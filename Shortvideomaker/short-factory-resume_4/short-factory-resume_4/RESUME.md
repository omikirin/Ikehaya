# 賽祈師クオン ショート動画 — 再開手順

short-video-makerスキルの途中経過。新チャットでこのZIPを展開して続行する。

## 完了済み
- 工程0: Remotionプロジェクト(手組み・TS5) ※node_modulesは除外→ `npm install` で復元
- 工程1-B: 台本 work/script_kuon.json(258字≈43秒・リント合格)
- 工程2: キャラリグ完了(public/head.png=口消し済み, public/body.png=透明, character.json=計測済み)
- TTS: fal MiniMax speech-02-turbo / voice_id=Lovely_Girl で生成成功済み(要・再生成)

## 未完了(ここから)
1. FAL_KEYをassets/.fal_keyに再設置(ユーザーに聞く。ZIPには含めていない)
2. TTS再生成→ v3b.fal.media からダウンロード(許可済みのはず)
3. asr_qc.py で機械検収 → declick_pauses.py → loudnorm → 再scan
4. whisperで字幕タイミング → cues執筆(フックA型キーアート・bg必須・moodは山谷配役)
5. Root.tsx作成 → tsc → 静止画QC → レンダ → quality-gates検収
