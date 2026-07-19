// 賽祈師クオン ―猫の目の選択― 紹介ショート(フックA型キーアート)
import type { Cue, Scene } from '../CharacterShort';

export const title = '';

export const cues: Cue[] = [
  // 0.0-1.9 フックtypo区間: 字幕なし
  { start: 1.9, text: '**2077年**' },
  { start: 3.9, text: '未来がぜんぶ\n予報される時代' },
  { start: 6.1, text: '統計のはずれ値だった少年は', mood: 'sad' },
  { start: 8.6, text: '猫耳の配信者\nクオンに頼んだ' },
  { start: 11.5, text: '人生を|**振り直してほしい**', mood: 'serious' },
  // 14.1-16.0 typoカード区間: 字幕なし
  { start: 16.0, text: 'お前の明日は\n**お前が選べ**', mood: 'serious', gesture: 'point' },
  { start: 18.9, text: '託されたのは\n黒いサイコロがひとつ' },
  { start: 22.0, text: '祈りは**83年**をさかのぼり' },
  { start: 25.2, text: '少年は西暦2000年に落ちる' },
  { start: 28.1, text: 'そこにいたのは\nまだ何も知らない', mood: 'smile' },
  { start: 30.6, text: '**15歳**のクオン', mood: 'smile', gesture: 'open' },
  // 32.6-35.9 typoカード区間: 字幕なし
  { start: 35.9, text: 'ふたつの賽が触れるとき', mood: 'serious' },
  { start: 38.1, text: '賭けは**選択**に変わる', mood: 'serious', gesture: 'nod' },
  { start: 42.2, text: '長編小説|**賽祈師クオン**', mood: 'smile' },
  { start: 45.2, text: '猫の目の選択', mood: 'wink' },
];

export const scenes: Scene[] = [
  // フックA: キーアート(黒サイコロ)×朱背景×slam
  { start: 0, type: 'typo', text: '運命は\n**サイコロだ**', src: 'keyart-die.png', bg: 'shu', slam: true, flash: true },
  { start: 1.9, type: 'still', src: 'broll-2077.png', kb: { from: [1.08, 0, 0], to: [1.22, -18, -10] } },
  { start: 6.1, type: 'avatar', zoom: 1.0 },
  { start: 14.1, type: 'typo', text: '返事は\n**やだね**', bg: 'mono', flash: true },
  { start: 16.0, type: 'avatar', zoom: 1.15, punch: 1.08 },
  { start: 22.0, type: 'still', src: 'broll-2000.png', kb: { from: [1.2, 15, 10], to: [1.06, 0, 0] } },
  { start: 28.1, type: 'avatar', zoom: 1.05 },
  { start: 32.6, type: 'typo', text: '賽に祈る者と\n書いて\n**賽祈師**', bg: 'washi' },
  { start: 35.9, type: 'avatar', zoom: 1.15, punch: 1.06 },
  { start: 40.1, type: 'typo', text: '出目が悪けりゃ\n**振り直せばいい**', bg: 'shu', slam: true },
  { start: 42.2, type: 'avatar', zoom: 1.0 },
  // エンドCTA(音声終了47.3s以降)
  { start: 47.3, type: 'cta', text: '**フォロー**で|続きが届きます' },
];
