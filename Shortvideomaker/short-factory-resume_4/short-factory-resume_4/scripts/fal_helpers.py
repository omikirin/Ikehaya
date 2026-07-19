#!/usr/bin/env python3
"""fal API呼び出しヘルパー(TTS/画像/BGM) — このスキルの生成系はこれ1本で足りる。

セットアップ:
  1. https://fal.ai でAPIキーを取得
  2. 環境変数 FAL_KEY にセットする(推奨)。またはプロジェクト直下に .fal_key ファイル
     を置いて中身にキーだけを書く(.gitignoreに必ず入れる。配布物に混ぜない)

使い方(CLI):
  python3 fal_helpers.py tts   "こんにちは" out/voice.mp3 --voice-id <your_voice_id>
  python3 fal_helpers.py image "chibi character, green background" out/char.png --size portrait_16_9
  python3 fal_helpers.py bgm   "calm lo-fi loop" out/bgm.wav --seconds 10

使い方(import):
  from fal_helpers import fal_queue, download, first_url
  res = fal_queue("fal-ai/minimax/speech-02-turbo", {...})
  download(first_url(res), "out/voice.mp3")

モデルIDの既定値は2026-07時点の実測で疎通したもの。falのモデルは改廃があるので、
404が返ったら https://fal.ai/models で現行IDを確認して --model で差し替える。
"""
import argparse
import json
import os
import sys
import time
import urllib.request

QUEUE = "https://queue.fal.run"

# 2026-07実測で疎通したモデルID(改廃時は--modelで上書き)
MODEL_TTS = "fal-ai/minimax/speech-02-turbo"
MODEL_IMAGE = "fal-ai/gpt-image-2"
MODEL_BGM = "fal-ai/stable-audio-25/text-to-audio"


def _key() -> str:
    k = os.environ.get("FAL_KEY", "").strip()
    if not k and os.path.exists(".fal_key"):
        k = open(".fal_key").read().strip()
    if not k:
        sys.exit("FAL_KEYが未設定です(環境変数FAL_KEY、またはプロジェクト直下の.fal_keyファイル)")
    return k


def _req(url: str, payload=None) -> dict:
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Authorization": f"Key {_key()}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def fal_queue(model: str, payload: dict, timeout_s: int = 600) -> dict:
    """キューAPIでモデルを実行し、完了レスポンス(dict)を返す。

    生成系は数十秒〜数分かかるため、同期API(fal.run)でなくキューAPIを使うのが正
    (同期はゲートウェイのタイムアウトで落ちることがある)。
    """
    sub = _req(f"{QUEUE}/{model}", payload)
    status_url = sub["status_url"]
    response_url = sub["response_url"]
    t0 = time.time()
    while True:
        st = _req(status_url)
        if st["status"] == "COMPLETED":
            return _req(response_url)
        if st["status"] in ("FAILED", "CANCELLED"):
            sys.exit(f"fal失敗: {json.dumps(st, ensure_ascii=False)[:500]}")
        if time.time() - t0 > timeout_s:
            sys.exit(f"falタイムアウト({timeout_s}s): {status_url}")
        time.sleep(2)


def first_url(obj) -> str:
    """レスポンスから最初の成果物URLを取り出す(モデルごとのキー名差異を吸収)。"""
    if isinstance(obj, dict):
        for k in ("url",):
            v = obj.get(k)
            if isinstance(v, str) and v.startswith("http"):
                return v
        for v in obj.values():
            u = first_url(v)
            if u:
                return u
    elif isinstance(obj, list):
        for v in obj:
            u = first_url(v)
            if u:
                return u
    return ""


def download(url: str, out_path: str) -> None:
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    urllib.request.urlretrieve(url, out_path)
    print(f"saved: {out_path} ({os.path.getsize(out_path)} bytes)")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)

    t = sub.add_parser("tts", help="MiniMaxボイスクローンTTS")
    t.add_argument("text")
    t.add_argument("out")
    t.add_argument("--voice-id", required=True, help="MiniMaxのクローンvoice_id")
    t.add_argument("--speed", type=float, default=1.0)
    t.add_argument("--model", default=MODEL_TTS)

    i = sub.add_parser("image", help="静止画生成(キャラ・Bロール)")
    i.add_argument("prompt")
    i.add_argument("out")
    i.add_argument("--size", default="portrait_16_9", help="プリセット名のみ(ピクセル指定は422)")
    i.add_argument("--model", default=MODEL_IMAGE)

    b = sub.add_parser("bgm", help="BGM生成")
    b.add_argument("prompt")
    b.add_argument("out")
    b.add_argument("--seconds", type=int, default=10)
    b.add_argument("--model", default=MODEL_BGM)

    a = ap.parse_args()
    if a.cmd == "tts":
        res = fal_queue(a.model, {
            "text": a.text,
            "voice_setting": {"voice_id": a.voice_id, "speed": a.speed, "vol": 1.0, "pitch": 0},
            "audio_setting": {"sample_rate": 44100, "format": "mp3"},
        })
    elif a.cmd == "image":
        res = fal_queue(a.model, {"prompt": a.prompt, "image_size": a.size})
    else:
        res = fal_queue(a.model, {"prompt": a.prompt, "seconds_total": a.seconds})
    url = first_url(res)
    if not url:
        sys.exit(f"成果物URLが見つからない: {json.dumps(res, ensure_ascii=False)[:500]}")
    download(url, a.out)


if __name__ == "__main__":
    main()
