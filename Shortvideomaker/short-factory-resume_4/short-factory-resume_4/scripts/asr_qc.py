#!/usr/bin/env python3
"""ASR機械検収: 全文照合+数字全数一致+リスク語の単独切り出しASR(references/quality-gates.mdの型)
usage: python3 scripts/asr_qc.py <name> <voice.m4a> <script.json> <リスク語カンマ区切り>
前提: pip install openai-whisper / ffmpegがPATHにあること
- リスク語=音訓の読みが揺れる複合語・レア熟語(quality-gates.md参照)。単独切り出しで実際の音を露呈させる
- モデルは環境変数 WHISPER_MODEL で変更可(既定 large-v3-turbo。軽くするなら medium)
"""
import json, os, re, subprocess, sys, unicodedata
from pathlib import Path

import whisper

name, voice, script_path, risk_words = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4].split(',')
work = Path('work')
(work / f'{name}_asr_clips').mkdir(parents=True, exist_ok=True)
(work / 'asr').mkdir(parents=True, exist_ok=True)

# ⚠️切り出しは必ずWAVから行う(m4a/aacの-ssシークは編集リスト・プライミングで
# 数百msズレることがあり、1秒未満の単独クリップが別区間の音になる=実測)
wav = work / f'{name}_qc_src.wav'
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', voice, str(wav)], check=True)
voice = str(wav)

model = whisper.load_model(os.environ.get('WHISPER_MODEL', 'large-v3-turbo'))
result = model.transcribe(voice, language='ja', word_timestamps=True)
json.dump(result, open(work / 'asr' / f'voice-{name}.json', 'w'), ensure_ascii=False, default=float)

script = json.load(open(script_path))
script_text = ''.join(s['text'] for s in script['segments'])
asr_text = result['text']

KANJI_NUM = {'〇':'0','一':'1','二':'2','三':'3','四':'4','五':'5','六':'6','七':'7','八':'8','九':'9','十':'10','百':'100','千':'1000'}
def norm(t):
    t = unicodedata.normalize('NFKC', t)
    t = re.sub(r'[、。,.!?！？\s「」・…〜ー]', '', t)
    # 全文照合にもかな数詞正規化を適用する(数字照合と同じ基準に揃える)。
    # これが無いと「みっつ目」等のかな書き台本が、数字照合=一致なのに全文照合=不一致になる
    t = kana_num(t)
    for k, v in KANJI_NUM.items():
        t = t.replace(k, v)
    return t

# かな数詞→算用数字(TTS誤読対策のかな書き台本とASRの算用表記を照合可能にする)
# ※誤爆防止のため、読みが一意なかな数詞に限り、かつ助数詞が続く場合だけ変換する
#   (「ご」「し」等の同音多義や、「ななめ」「ふたたび」等の一般語は変換しない)
COUNTER = r'(?=つ|回|年|人|万|億|円|個|本|日|時|分|割|席|件|通|枚)'
KANA_NUM = [('じゅうなな', '17'), ('じゅうきゅう', '19'), ('じゅうはち', '18'),
            ('ここの', '9'), ('やっ', '8'), ('なな', '7'), ('むっ', '6'), ('いつ', '5'),
            ('よっ', '4'), ('みっ', '3'), ('ふた', '2'), ('ひと', '1'), ('きゅう', '9'), ('とお', '10')]

def kana_num(t):
    for k, v in KANA_NUM:
        t = re.sub(re.escape(k) + COUNTER, v, t)
    return t

def digits(t):
    t = unicodedata.normalize('NFKC', t)
    t = kana_num(t)
    # 漢数字も算用へ寄せた上で数字列を抽出
    for k, v in KANJI_NUM.items():
        t = t.replace(k, v)
    return re.findall(r'\d+', t)

print(f'=== {name} 全文照合 ===')
ns, na = norm(script_text), norm(asr_text)
print('台本:', len(ns), '字 / ASR:', len(na), '字 / 完全一致:', ns == na)
if ns != na:
    import difflib
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, ns, na).get_opcodes():
        if op != 'equal':
            print(f'  {op}: 台本「{ns[i1:i2]}」 vs ASR「{na[j1:j2]}」')

print(f'=== {name} 数字全数照合 ===')
ds, da = digits(script_text), digits(asr_text)
print('台本:', ds); print('ASR :', da); print('一致:', ds == da)

print(f'=== {name} リスク語 単独切り出しASR ===')
words = [w for seg in result['segments'] for w in seg.get('words', [])]
joined = ''.join(w['word'] for w in words)
# 語→word index範囲を探す(結合文字列上の位置から逆引き)
pos = 0; spans = []
for w in words:
    spans.append((pos, pos + len(w['word']), w)); pos += len(w['word'])
for target in risk_words:
    target = target.strip()
    hits = [m.start() for m in re.finditer(re.escape(target), joined)]
    if not hits:
        print(f'  ⚠️「{target}」: ASR全文に見つからず(誤読の疑い→全文diffを確認)')
        continue
    for hi, h in enumerate(hits):
        ws = [w for s, e, w in spans if s < h + len(target) and e > h]
        t0 = max(0, ws[0]['start'] - 0.15); t1 = ws[-1]['end'] + 0.15
        clip = work / f'{name}_asr_clips' / f'{target}_{hi}.wav'
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', voice,
                        '-ss', str(t0), '-to', str(t1), str(clip)], check=True)
        solo = model.transcribe(str(clip), language='ja')
        got = norm(solo['text'])
        ok = norm(target) in got or got in norm(target) or got == norm(target)
        print(f'  {"✅" if ok else "⚠️"}「{target}」#{hi} ({t0:.2f}-{t1:.2f}s) → 単独ASR「{solo["text"].strip()}」')
