// 空の狐と地上のウサギ 紹介(フックE漫画コマ型・ウカ一人称)
import type { Cue, Scene } from '../CharacterShort';

export const title = '';

export const cues: Cue[] = [
  // 0-3.6 フック漫画コマ: 字幕なし
  { start: 3.7, text: 'わたしは**ウカ**' },
  { start: 5.4, text: '空を飛ぶ きつね' },
  { start: 7.7, text: '泣く代わりに\nひとつの名前を覚えた' },
  { start: 14.3, text: 'ふるさとを撃った\n**英雄**の名' },
  { start: 17.2, text: '復讐のために\n空へ上がった' },
  { start: 20.3, text: 'でもね この物語には\n**続き**があるの', mood: 'smile' },
  // 24.27-28.97 typoカード: 字幕なし
  { start: 29.0, text: '彼の妻 **オト**' },
  { start: 31.3, text: '世界のすべてを測れるのに' },
  { start: 33.3, text: '人の心だけ**測れない** 優しいひと' },
  { start: 36.6, text: 'ふるさとを消す**数式**を\n解いたひと' },
  { start: 41.2, text: '狐と ウサギ', mood: 'serious' },
  { start: 43.7, text: '撃った側と 撃たれた側', mood: 'serious' },
  { start: 45.9, text: 'ふたりが出会ったとき', mood: 'serious', gesture: 'point' },
  { start: 47.6, text: '物語が**動き出す**', mood: 'serious', gesture: 'nod' },
  // 49.38-52.84 typoカード: 字幕なし
  { start: 53.3, text: '続きは**プロフィール**から', mood: 'wink' },
];

export const scenes: Scene[] = [
  // フックE: 漫画コマ(ウカ「泣かなかった」顔)×slam
  { start: 0, type: 'manga', src: 'panel_uka_face.png', slam: true, flash: true, text: 'ふるさとが\n**消えた**' },
  { start: 3.6, type: 'avatar', zoom: 1.0 },
  { start: 7.63, type: 'still', src: 'panel_fist.png', kb: { from: [1.06, 0, 0], to: [1.18, -10, -6] } },
  { start: 12.49, type: 'manga', src: 'panel_name.png', flash: true },
  { start: 17.07, type: 'still', src: 'panel_canopy.png', kb: { from: [1.18, 10, 6], to: [1.05, 0, 0] } },
  { start: 20.19, type: 'avatar', zoom: 1.1, punch: 1.05 },
  { start: 24.27, type: 'typo', text: '弾道を計算したのは\n**ガレンじゃない**', bg: 'mono', slam: true },
  { start: 28.97, type: 'still', src: 'panel_oto_board.png', kb: { from: [1.05, 0, 0], to: [1.2, 8, -8] } },
  { start: 36.5, type: 'still', src: 'panel_oto_write.png', kb: { from: [1.2, -8, 8], to: [1.05, 0, 0] } },
  { start: 41.16, type: 'avatar', zoom: 1.0 },
  { start: 45.82, type: 'avatar', zoom: 1.18, punch: 1.06 },
  { start: 49.38, type: 'typo', text: '空の狐と\n**地上のウサギ**', bg: 'washi' },
  { start: 53.24, type: 'avatar', zoom: 1.05 },
  // 音声終了56.3s以降 CTA
  { start: 56.3, type: 'cta', text: '**プロフィール**から\n続きが読めます' },
];
