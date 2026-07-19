#!/usr/bin/env python3
"""ポーズ内クリック(舌打ち・口腔ノイズ)の検出と除去。
検出条件: 短い過渡音(<40ms)がピーク>0.05 で、前後±80ms(過渡音を除く)の
エンベロープが<0.02(=静寂の中の孤立ノイズ)。発話中の破裂音は前後が鳴っているので拾わない。
usage:
  python3 scripts/declick_pauses.py scan <audio...>       # 検出のみ
  python3 scripts/declick_pauses.py fix  <audio...>       # 検出→ゼロ化(4msフェード)→上書き
"""
import subprocess, sys
from pathlib import Path
import numpy as np

SR = 48000

def load(path):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(path),
                    '-ar', str(SR), '-ac', '1', '-f', 'f32le', '/tmp/_declick.f32'], check=True)
    return np.fromfile('/tmp/_declick.f32', dtype=np.float32)

def find_clicks(x):
    w = SR // 1000  # 1ms
    m = len(x) // w
    env = np.abs(x[:m * w]).reshape(m, w).max(axis=1)
    clicks = []
    i = 0
    while i < m:
        if env[i] <= 0.05:
            i += 1; continue
        # 本体(>0.05)から前後へ、尻尾(>0.015)が続く限り1塊として拡張(ヒステリシス)
        a = i
        while a > 0 and env[a - 1] > 0.015:
            a -= 1
        j = i
        while j < m and env[j] > 0.015:
            j += 1
        dur = j - a  # ms
        if dur < 80:
            pre = env[max(0, a - 80):a]
            post = env[j:j + 80]
            ctx = np.concatenate([pre, post])
            if len(ctx) and ctx.max() < 0.022:
                clicks.append((a, j, float(env[a:j].max())))
        i = j
    return clicks

def fix_file(path, clicks, x):
    fade = int(0.004 * SR)
    for a_ms, b_ms, _ in clicks:
        a = max(0, (a_ms - 8) * SR // 1000)
        b = min(len(x), (b_ms + 8) * SR // 1000)
        x[a:b] = 0.0
        # 縁を短いコサインフェードでなじませる
        if a - fade >= 0:
            x[a - fade:a] *= np.cos(np.linspace(0, np.pi / 2, fade)) ** 2
        if b + fade <= len(x):
            x[b:b + fade] *= np.sin(np.linspace(0, np.pi / 2, fade)) ** 2
    x.tofile('/tmp/_declick_out.f32')
    codec = ['-c:a', 'aac', '-b:a', '192k'] if path.suffix == '.m4a' else ['-c:a', 'libmp3lame', '-b:a', '192k']
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(SR),
                    '-i', '/tmp/_declick_out.f32', *codec, str(path)], check=True)

def main():
    mode, files = sys.argv[1], sys.argv[2:]
    for f in files:
        p = Path(f)
        x = load(p)
        clicks = find_clicks(x)
        tag = f'{p.parent.name}/{p.name}'
        if not clicks:
            print(f'  ✅ {tag}: クリックなし')
            continue
        for a, b, pk in clicks:
            print(f'  ⚠️ {tag}: {a/1000:.3f}-{b/1000:.3f}s peak={pk:.3f}')
        if mode == 'fix':
            fix_file(p, clicks, x)
            print(f'     → ゼロ化して上書きした({len(clicks)}箇所)')

if __name__ == '__main__':
    main()
