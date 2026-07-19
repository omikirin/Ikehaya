// cues/scenesのサンプル。新しい動画は必ずこのファイルをコピーして作る(形を揃える)。
// 執筆の掟はSKILL.md工程4と references/hook-styles.md を参照。
import type { Cue, Scene } from '../CharacterShort';

// タイトル(フックのタイポが兼ねるなら空文字)
export const title = '';

// 字幕。startは秒。**語**=強調(1色のみ)・「|」=どどど演出(入れすぎ禁止)
export const cues: Cue[] = [
  { start: 0.0, text: 'ここに|フックの|一撃' },
  { start: 4.5, text: '本編の字幕が始まります', gesture: 'nod' },
  // moodは7種(smile/laugh/stern/sad/serious/wink/無指定=normal)。にこにこ一辺倒にしない=山と谷を両方置く
  // シリアス・苦い話=stern、損・後悔=sad、決意・断言=serious、オチ・軽口=wink
  { start: 6.0, text: 'でも**苦い現実**は\n見過ごせない', mood: 'stern' },
  // 8.0〜10.5はtypoカード区間=字幕を置かない(でか文字と二重になる)
  { start: 10.5, text: 'キャラが**大事な言葉**を話す', mood: 'smile', gesture: 'point' },
  { start: 12.0, text: '締めのひとこと', mood: 'laugh' },
];

// カット割り。startは秒。フック→本編(avatar/broll/still/typoを切り替え)→CTAの三幕
export const scenes: Scene[] = [
  // フック: 5型から記事の意味で選ぶ(references/hook-styles.md)
  { start: 0, type: 'typo', text: 'ここに|フックの|一撃', bg: 'shu', slam: true, flash: true },
  // 本編
  { start: 4.5, type: 'avatar', zoom: 1.0 },
  // 本編中のでか文字カードは必ずbgを敷く(断言=shu/速度=mono/告白・文化=washi。未指定はmonoに自動フォールバック)
  { start: 8.0, type: 'typo', text: '大事な言葉を\n**でか文字**で', bg: 'washi' },
  { start: 10.5, type: 'avatar', zoom: 1.15, punch: 1.08 },
  { start: 12.0, type: 'still', src: 'broll-sample.png', kb: { from: [1.08, 0, 0], to: [1.2, -20, 0] } },
  // エンドCTA: 音声なし・BGMのみ継続
  { start: 15.0, type: 'cta', text: '**フォロー**で|続きが届きます' },
];
