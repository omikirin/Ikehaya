#!/usr/bin/env python3
"""全書籍の漫画ネーム(name/ep*.md)を1枚のHTMLビューアに変換する。

使い方: python3 build_name_viewer.py [出力パス]
出力: 既定 publishing/build/name_viewer.html
"""
import html
import json
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent

# slug → (キャラ, クラン, ジャンル)
META = {
    "jin-battle": ("刃", "伊賀", "バトル"), "kanaoni-gourmet": ("金鬼", "伊賀", "グルメ時代劇"),
    "anne-heartwarming": ("餡音", "伊賀", "ほのぼの日常"), "torika-spy": ("酉花", "伊賀", "スパイ"),
    "hayate-adventure": ("ハヤテ", "伊賀", "冒険活劇"), "yui-coming-of-age": ("結", "伊賀", "成長譚"),
    "rei-family-drama": ("令", "伊賀", "母娘ドラマ"), "karura-sky-battle": ("カルラ", "伊賀", "空戦"),
    "shion-gothic": ("紫苑", "伊賀", "ゴシック"), "sekishusai-jidai": ("石舟斎", "伊賀", "時代小説"),
    "sakuya-mystery": ("咲耶", "甲賀", "ミステリー"), "oto-sports": ("於兎", "甲賀", "スポ根"),
    "uka-dark-fantasy": ("宇迦", "甲賀", "ダークファンタジー"), "ganzi-saga": ("岩爺", "甲賀", "歴史大河"),
    "nemu-youth": ("ネム", "甲賀", "青春"), "xiaolan-wuxia": ("シャオラン", "甲賀", "武侠"),
    "konga-fighting": ("コンガ", "甲賀", "熱血格闘"), "oen-medical": ("おえん", "甲賀", "医療人情"),
    "izuna-prequel": ("イズナ", "甲賀", "前日譚"), "kohaku-swordplay": ("狐白", "風魔", "剣戟"),
    "rotten-picaresque": ("呂屯", "風魔", "ピカレスク"), "dan-scifi": ("断", "風魔", "SF"),
    "atoza-war-chronicle": ("アトザ", "風魔", "戦記"), "janome-crime": ("蛇ノ目", "風魔", "クライム"),
    "karma-revenge": ("カルマ", "風魔", "復讐劇"), "aum-brotherhood": ("アウン", "風魔", "兄弟愛"),
    "ibuki-onmyo": ("イブキ", "風魔", "陰陽師怪異譚"), "shiba-ocean": ("柴", "雑賀", "海洋冒険"),
    "nagisa-comedy": ("凪紗", "雑賀", "学園コメディ"), "hinanojoh-craftsman": ("雛之丞", "雑賀", "職人"),
    "fuuta-shonen": ("風太", "雑賀", "少年剣士"), "nekomata-horror": ("猫又", "雑賀", "ホラー"),
    "benten-romance": ("弁天", "雑賀", "恋愛"), "ichiya-cipher": ("イチヤ", "雑賀", "暗号ミステリー"),
    "seori-kaidan": ("瀬織", "雑賀", "怪談"), "quon-timeloop": ("久遠", "雑賀", "時間もの"),
    "magoichi-hardboiled": ("孫市", "雑賀", "ハードボイルド"), "sattva-myth": ("サットヴァ", "天界", "神話幻想"),
    "sasagane-dark": ("ささがね", "根の国", "悲哀ダーク"), "gokou-yokai": ("ゴコウ", "根の国", "妖怪奇譚"),
    "shinra-dark": ("シンラ", "根の国", "哲学ダーク"), "sasura-wanderer": ("サスラ", "根の国", "流浪"),
}
CLAN_ORDER = ["伊賀", "甲賀", "風魔", "雑賀", "天界", "根の国"]


def parse_ep(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    title = ""
    for l in lines:
        if l.startswith("# "):
            title = re.sub(r"^#\s*(ネーム\s*)?", "", l).strip()
            break
    pages, cur = [], None
    for l in lines:
        m = re.match(r"^##\s*(.+)$", l)
        if m:
            head = m.group(1).strip()
            cur = {"head": head, "spread": ("見開き" in head or bool(re.search(r"P\d+\s*[-−]\s*\d+", head))), "panels": [], "notes": []}
            pages.append(cur)
            continue
        if cur is None:
            continue
        s = l.strip()
        if not s:
            continue
        b = re.match(r"^[-*]\s+(.*)$", s)
        if b:
            cur["panels"].append(b.group(1))
        elif not s.startswith("#"):
            cur["notes"].append(s)
    return {"title": title or path.stem, "pages": pages}


def build() -> str:
    books = []
    for d in sorted((ROOT / "books").iterdir()):
        if not d.is_dir() or d.name == "_template" or not (d / "name").is_dir():
            continue
        meta = yaml.safe_load((d / "book.yaml").read_text(encoding="utf-8")) or {}
        char, clan, genre = META.get(d.name, ("?", "?", "?"))
        eps = [parse_ep(p) for p in sorted((d / "name").glob("ep*.md"))]
        books.append({
            "slug": d.name, "title": meta.get("title", d.name),
            "char": char, "clan": clan, "genre": genre,
            "pages_total": sum(len(e["pages"]) for e in eps), "eps": eps,
        })
    books.sort(key=lambda b: (CLAN_ORDER.index(b["clan"]) if b["clan"] in CLAN_ORDER else 9, b["slug"]))
    data = json.dumps(books, ensure_ascii=False, separators=(",", ":"))
    return TEMPLATE.replace("__DATA__", html.escape(data, quote=False).replace("</", "<\\/"))


TEMPLATE = r"""<title>CryptoNinja ネーム全集 — 42冊コマ割りビューア</title>
<style>
:root{
  --paper:#f4efe4;--paper2:#ece5d4;--ink:#26221c;--ink2:#5c554a;--line:#c9bfa9;
  --shu:#a8321f;--shu-soft:#f0ddd4;--panel:#fbf8f0;--se:#7a6c50;
}
@media (prefers-color-scheme: dark){:root{
  --paper:#211e19;--paper2:#2a2620;--ink:#e8e1d2;--ink2:#a89e8c;--line:#4a4436;
  --shu:#d96b4f;--shu-soft:#3a2620;--panel:#2e2a23;--se:#b0a380;
}}
:root[data-theme="dark"]{
  --paper:#211e19;--paper2:#2a2620;--ink:#e8e1d2;--ink2:#a89e8c;--line:#4a4436;
  --shu:#d96b4f;--shu-soft:#3a2620;--panel:#2e2a23;--se:#b0a380;
}
:root[data-theme="light"]{
  --paper:#f4efe4;--paper2:#ece5d4;--ink:#26221c;--ink2:#5c554a;--line:#c9bfa9;
  --shu:#a8321f;--shu-soft:#f0ddd4;--panel:#fbf8f0;--se:#7a6c50;
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);
  font-family:"Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,sans-serif;line-height:1.6}
.serif{font-family:"Hiragino Mincho ProN","Yu Mincho","MS PMincho",serif}
.app{display:flex;min-height:100vh}
nav{width:280px;flex-shrink:0;border-right:1px solid var(--line);background:var(--paper2);
  padding:16px 0;position:sticky;top:0;height:100vh;overflow-y:auto}
nav h1{font-size:15px;margin:0 16px 4px;letter-spacing:.08em}
nav .sub{font-size:11px;color:var(--ink2);margin:0 16px 14px}
.clan{font-size:11px;letter-spacing:.25em;color:var(--shu);border-top:1px solid var(--line);
  margin:10px 16px 4px;padding-top:10px}
.bk{display:block;width:100%;text-align:left;border:0;background:none;color:var(--ink);
  padding:5px 16px;font-size:12.5px;cursor:pointer;line-height:1.4}
.bk small{color:var(--ink2)}
.bk:hover{background:var(--shu-soft)}
.bk.on{background:var(--shu);color:#fff}
.bk.on small{color:#f5d9cf}
main{flex:1;padding:26px 32px 60px;min-width:0}
.crumb{font-size:12px;letter-spacing:.2em;color:var(--shu);margin:0 0 4px}
h2{margin:0 0 2px;font-size:24px;text-wrap:balance}
.meta{color:var(--ink2);font-size:13px;margin:0 0 18px}
.tabs{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 22px}
.tab{border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:3px;
  padding:5px 12px;font-size:12.5px;cursor:pointer}
.tab.on{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.eptitle{font-size:17px;margin:0 0 14px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px}
.pg{background:var(--panel);border:1px solid var(--line);border-radius:2px;padding:0 0 10px;
  box-shadow:0 1px 0 var(--line)}
.pg.spread{grid-column:1/-1;border-left:4px solid var(--shu)}
.pghead{display:flex;align-items:baseline;gap:8px;border-bottom:1px solid var(--line);
  padding:8px 12px;margin-bottom:8px}
.pgno{font-size:14px;font-weight:700;letter-spacing:.05em}
.pgtag{font-size:10.5px;color:#fff;background:var(--shu);border-radius:2px;padding:1px 7px;letter-spacing:.15em}
.koma{display:flex;gap:9px;padding:6px 12px;border-bottom:1px dashed var(--line);font-size:13px}
.koma:last-child{border-bottom:0}
.kn{flex-shrink:0;width:22px;height:22px;border:1.5px solid var(--ink);display:flex;
  align-items:center;justify-content:center;font-size:11px;font-weight:700;margin-top:2px}
.kt b{color:var(--shu)}
.kt .se{color:var(--se);font-family:ui-monospace,Menlo,monospace;font-size:12px}
.note{padding:4px 12px;font-size:12px;color:var(--ink2);font-style:italic}
.hint{color:var(--ink2);font-size:12px;margin:30px 0 0;border-top:1px solid var(--line);padding-top:10px}
@media(max-width:760px){.app{flex-direction:column}nav{width:100%;height:auto;position:static}}
@media(prefers-reduced-motion:no-preference){.pg{transition:transform .12s}.pg:hover{transform:translateY(-1px)}}
</style>
<div class="app">
<nav id="nav"></nav>
<main id="main"></main>
</div>
<script id="data" type="application/json">__DATA__</script>
<script>
const BOOKS=JSON.parse(document.getElementById('data').textContent);
const CLANS=["伊賀","甲賀","風魔","雑賀","天界","根の国"];
let cur=0, ep=0;
function esc(s){const d=document.createElement('span');d.textContent=s;return d.innerHTML}
function fmt(t){
  t=esc(t);
  t=t.replace(/SE[「『]([^」』]*)[」』]/g,'<span class="se">SE「$1」</span>');
  t=t.replace(/[「『]([^」』]{1,60})[」』]/g,'<b>「$1」</b>');
  return t;
}
function nav(){
  const el=document.getElementById('nav');
  let h='<h1 class="serif">CryptoNinja ネーム全集</h1><p class="sub">全'+BOOKS.length+'冊 / '
    +BOOKS.reduce((a,b)=>a+b.pages_total,0)+'ページ / 二次創作</p>';
  for(const c of CLANS){
    const bs=BOOKS.filter(b=>b.clan===c);
    if(!bs.length)continue;
    h+='<div class="clan">'+c+'</div>';
    for(const b of bs){const i=BOOKS.indexOf(b);
      h+='<button class="bk'+(i===cur?' on':'')+'" onclick="go('+i+')">'+esc(b.char)+'『'+esc(b.title)+'』<br><small>'
        +esc(b.genre)+' / '+b.pages_total+'P</small></button>';}
  }
  el.innerHTML=h;
}
function main(){
  const b=BOOKS[cur],e=b.eps[ep],el=document.getElementById('main');
  let h='<p class="crumb">'+esc(b.clan)+' / '+esc(b.char)+' / '+esc(b.genre)+'</p>'
    +'<h2 class="serif">'+esc(b.title)+'</h2><p class="meta">全'+b.eps.length+'話・ネーム'+b.pages_total+'ページ</p>'
    +'<div class="tabs">'+b.eps.map((x,i)=>'<button class="tab'+(i===ep?' on':'')+'" onclick="goEp('+i+')">第'+(i+1)+'話</button>').join('')+'</div>'
    +'<h3 class="eptitle serif">'+esc(e.title)+'</h3><div class="grid">';
  for(const p of e.pages){
    h+='<div class="pg'+(p.spread?' spread':'')+'"><div class="pghead"><span class="pgno">'+esc(p.head)+'</span>'
      +(p.spread?'<span class="pgtag">見開き</span>':'')+'</div>';
    p.panels.forEach((k,i)=>{
      const m=k.match(/^(\d+(?:[-−]\d+)?)\s*[::]\s*(.*)$/);
      const no=m?m[1]:String(i+1), body=m?m[2]:k;
      h+='<div class="koma"><div class="kn">'+esc(no)+'</div><div class="kt">'+fmt(body)+'</div></div>';
    });
    for(const n of p.notes)h+='<div class="note">'+fmt(n)+'</div>';
    h+='</div>';
  }
  h+='</div><p class="hint">右綴じ・右→左読み想定。太字=セリフ/モノローグ、等幅=効果音、朱帯=見開きの山場。原稿は各書籍の name/ep0N.md。</p>';
  el.innerHTML=h;window.scrollTo(0,0);
}
function go(i){cur=i;ep=0;nav();main()}
function goEp(i){ep=i;main()}
go(0);
</script>
"""

if __name__ == "__main__":
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "build" / "name_viewer.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(build(), encoding="utf-8")
    print(f"OK: {out} ({out.stat().st_size // 1024} KB)")
