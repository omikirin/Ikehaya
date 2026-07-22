import {
  AbsoluteFill,
  Audio,
  Img,
  Loop,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { useAudioData, visualizeAudio } from '@remotion/media-utils';

// ============================================================
// CharacterShort — キャラ差し替え可能な縦ショート動画テンプレート
// 1080x1920 / 30fps 前提。キャラ固有値はすべて CharacterConfig で注入する。
// このファイル内にキャラ名・画像座標・ブランド色を直書きしない(検収項目)。
// ============================================================

export type HookBg = 'shu' | 'mono' | 'washi';

export type Cue = {
  start: number; // 秒
  text: string; // **語**=アクセント色強調 / 「|」=塊ごとの順ポップ(どどど)
  mood?: 'normal' | 'smile' | 'laugh' | 'stern' | 'sad' | 'serious' | 'wink';
  gesture?: 'nod' | 'point' | 'open';
};

export type Scene = {
  start: number; // 秒
  type: 'avatar' | 'broll' | 'still' | 'typo' | 'cta' | 'number' | 'split' | 'manga';
  src?: string; // 画像(still/typo決め絵/split上段/manga)
  srcB?: string; // split下段
  videoSrc?: string; // broll動画 / typoの動画背景
  text?: string;
  num?: string; // numberフックの巨大数字
  numLabel?: string; // numberフックの前置き
  labelA?: string; // splitの上段ラベル
  labelB?: string; // splitの下段ラベル
  bg?: HookBg; // コード描画の背景プリセット
  zoom?: number; // avatarの寄り引き
  punch?: number; // カット頭パンチイン初期倍率(default 1.05)
  kb?: { from: readonly [number, number, number]; to: readonly [number, number, number] }; // Ken Burns [scale,x,y]
  mirror?: boolean;
  flash?: boolean; // カット頭の白フラッシュ
  slam?: boolean; // 一文字ずつ叩き付け
  jitter?: boolean; // 静止素材の微振動
  dim?: number; // typo動画/写真背景の暗幕濃度
  textPos?: 'top' | 'middle' | 'center';
};

export type CharacterConfig = {
  // キャラ素材のネイティブ寸法(全レイヤー同寸で作る)
  canvas: { width: number; height: number };
  images: {
    body: string; // 胴体(通常)
    head: string; // 頭(口なしで描く。口はコードが描画)
    eyeLid?: string; // 瞼パッチ(白目領域を塗った差分。無ければ楕円塗りで代用)
    bodyPoint?: string; // 指差しポーズ差分(任意)
    bodyOpen?: string; // 両手広げポーズ差分(任意)
    handPoint?: string; // 指差しの手だけ前面に出すレイヤー(任意)
    hookBase?: string; // numberフック下端に置く全身絵(任意)
  };
  mouth: {
    cx: number; // 口の中心X(ネイティブ座標)
    top: number; // 開いた口の上端Y
    fill: string; // 口内の色
    tongue: string; // 舌の色
    line: string; // 輪郭線の色
  };
  eyes: { cx: number; cy: number }[]; // 目の中心(左・右)
  eyePatch?: { rx: number; ry: number; color: string }; // eyeLid無し時の塗り(肌色)
  cheeks?: { cx: number; cy: number }[]; // 頬紅の位置(任意)
  cheekColor?: string;
  browColor?: string; // 眉の中の色(未指定は口の線色)。髪色に合わせる用
  browLineColor?: string; // 眉の縁の線色(未指定=縁なし)
  browLineWidth?: number; // 眉の縁の太さ(default 3)
  headPivot: { x: number; y: number }; // 頷きの回転軸(首の付け根)
  // 元絵の口・目を隠す肌色パッチ(口消し前のhead.pngを使うとき用。描画パーツより下に敷く)
  covers?: { cx: number; cy: number; rx: number; ry: number; color: string; rot?: number; show?: string; pair?: number }[];
  mouthScale?: number; // 口パク描画の大きさ倍率(default 1)
  // 表情ベクターの微調整: 各パーツの線幅wと、アンカー点オフセットp=[[dx,dy],...](左目基準・右目は鏡映)
  faceTune?: Partial<Record<'smileEye' | 'blinkLine' | 'sternBrow' | 'sternLid' | 'sadBrow' | 'seriousBrow' | 'winkArc' | 'closedMouth', { w?: number; p?: number[][] }>>;
  eyeScale?: number; // 目の表情描画(にっこり・瞬き等の弧)の大きさ倍率(default 1)
  displayHeight?: number; // 画面上の表示高さ(default 620)
  faceCenterRatio?: number; // 表示高さに対する顔中心の位置(default 0.32・後光リングの中心)
};

export type Theme = {
  bg: string; // 地の色
  ink: string; // 文字色
  accent: string; // 強調色(**語**・プログレスバー・後光)
  font: string;
};

// 既定テーマ。ブランドに合わせて差し替えてよい(値の変更はここではなくprops側で)
export const DEFAULT_THEME: Theme = {
  bg: '#0b0e14',
  ink: '#f2efe8',
  accent: '#d9b36a',
  font: '"Hiragino Sans", "Noto Sans JP", sans-serif',
};

const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// **語**=アクセント色強調。テキストに「|」があれば塊ごとに順ポップ(どどど演出)。
const renderRich = (
  text: string,
  accent: string,
  pop?: { frame: number; startFrame: number; interval: number; popFrames: number }
) => {
  const animated = Boolean(pop) && text.includes('|');
  let chunkIndex = 0;
  return text.split('\n').map((line, li) => (
    <div key={li}>
      {line.split('|').map((chunk, ci) => {
        const idx = chunkIndex;
        chunkIndex += 1;
        let style: React.CSSProperties | undefined;
        if (animated && pop) {
          const p = interpolate(
            pop.frame - (pop.startFrame + idx * pop.interval),
            [0, pop.popFrames],
            [0, 1],
            CLAMP
          );
          style = {
            display: 'inline-block',
            opacity: p,
            transform: `scale(${1.3 - p * 0.3}) translateY(${(1 - p) * 10}px)`,
          };
        }
        return (
          <span key={ci} style={style}>
            {chunk
              .split(/(\*\*[^*]+\*\*)/g)
              .filter(Boolean)
              .map((part, i) =>
                part.startsWith('**') ? (
                  <span key={i} style={{ color: accent }}>
                    {part.slice(2, -2)}
                  </span>
                ) : (
                  <span key={i}>{part}</span>
                )
              )}
          </span>
        );
      })}
    </div>
  ));
};

// 一文字ずつ叩き付け(slam)。「|」不要・強調**語**はアクセント色のまま。
const renderSlam = (text: string, frame: number, startFrame: number, accent: string) => {
  let idx = 0;
  return text.split('\n').map((line, li) => (
    <div key={li}>
      {line
        .split(/(\*\*[^*]+\*\*)/g)
        .filter(Boolean)
        .map((part, pi) => {
          const isAccent = part.startsWith('**');
          const body = isAccent ? part.slice(2, -2) : part;
          return (
            <span key={pi} style={isAccent ? { color: accent } : undefined}>
              {[...body].map((ch, ci) => {
                const i = idx;
                idx += 1;
                const p = interpolate(frame - (startFrame + i * 2), [0, 4], [0, 1], CLAMP);
                const settle = interpolate(frame - (startFrame + i * 2), [4, 7], [1.06, 1], CLAMP);
                return (
                  <span
                    key={ci}
                    style={{
                      display: 'inline-block',
                      opacity: p,
                      transform: `scale(${(2.4 - 1.4 * p) * settle}) rotate(${
                        (1 - p) * (i % 2 ? 5 : -5)
                      }deg)`,
                    }}
                  >
                    {ch}
                  </span>
                );
              })}
            </span>
          );
        })}
    </div>
  ));
};

// 背景プリセット: 透過決め絵・巨大数字・漫画コマの下に敷くコード描画の背景。
// shu=朱ベタ×黒集中線 / mono=黒×白速度線 / washi=和紙×金雲
const HookBackground: React.FC<{ bg: HookBg; theme: Theme }> = ({ bg, theme }) => {
  if (bg === 'washi') {
    const scallops = (y: number, flip: boolean) => {
      let d = `M -60 ${y}`;
      for (let i = 0; i < 12; i++) d += ` q 90 ${flip ? 76 : -76} 180 0`;
      return d;
    };
    return (
      <AbsoluteFill style={{ background: '#efe6d2' }}>
        <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
          <g fill="none" stroke="#b8933f" strokeWidth={6} opacity={0.55}>
            <path d={scallops(150, false)} />
            <path d={scallops(240, false)} strokeWidth={3} opacity={0.7} />
            <path d={scallops(880, true)} />
            <path d={scallops(790, true)} strokeWidth={3} opacity={0.7} />
          </g>
        </svg>
      </AbsoluteFill>
    );
  }
  const isShu = bg === 'shu';
  const base = isShu ? '#a63a33' : theme.bg;
  const lineColor = isShu ? 'rgba(22,10,8,0.82)' : 'rgba(242,239,232,0.85)';
  const cx = 960;
  const cy = 540;
  const count = isShu ? 42 : 64;
  const spread = isShu ? 0.024 : 0.007; // 集中線1本の太さ(rad)。朱は漫画の集中線・黒は細い速度線
  const wedges = Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    const reach = 0.3 + 0.18 * Math.abs(Math.sin(i * 7.31)); // 中心へ届く割合(擬似ランダム)
    const rOuter = 1500;
    const rInner = rOuter * reach;
    const pts = [
      [cx + Math.cos(a - spread) * rOuter, cy + Math.sin(a - spread) * rOuter],
      [cx + Math.cos(a + spread) * rOuter, cy + Math.sin(a + spread) * rOuter],
      [cx + Math.cos(a) * rInner, cy + Math.sin(a) * rInner],
    ]
      .map((p) => p.map((v) => v.toFixed(1)).join(','))
      .join(' ');
    return <polygon key={i} points={pts} fill={lineColor} />;
  });
  return (
    <AbsoluteFill style={{ background: base }}>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {wedges}
      </svg>
    </AbsoluteFill>
  );
};

export const CharacterShortWide: React.FC<{
  title: string;
  audioSrc: string;
  character: CharacterConfig;
  theme?: Theme;
  bgmSrc?: string;
  seDonSrc?: string; // どどど同期SE。省略時 'se-don.wav'
  cues: Cue[];
  scenes?: Scene[];
  // AI音声の開示表記。クローン/合成音声の回では必須(quality-gates参照)
  aiVoiceLabel?: string;
}> = ({
  title,
  audioSrc,
  character,
  theme = DEFAULT_THEME,
  bgmSrc,
  seDonSrc = 'se-don.wav',
  cues,
  scenes = [],
  aiVoiceLabel,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const audioData = useAudioData(staticFile(audioSrc));

  const { bg: BG, ink: INK, accent: ACCENT, font: FONT } = theme;
  const CW = character.canvas.width;
  const CH = character.canvas.height;
  const M = character.mouth;
  const EYES = character.eyes;
  const DISP_H = character.displayHeight ?? 620;
  const SCALE = DISP_H / CH;
  const DISP_W = CW * SCALE;
  // アバターの画面レイアウト(1080x1920前提でDISP_Hから導出)
  const CHAR_TOP = 1080 - DISP_H - 56;
  const RING_CY = CHAR_TOP + DISP_H * (character.faceCenterRatio ?? 0.32);
  const RING_R = Math.round(DISP_H * 0.41);
  const SHADOW_TOP = CHAR_TOP + DISP_H + 3;

  // 字幕: start <= t の最後のcueを次のcueまで表示
  let cueIndex = -1;
  for (let i = 0; i < cues.length; i++) {
    if (cues[i].start <= t) cueIndex = i;
  }
  const cue = cueIndex >= 0 ? cues[cueIndex] : null;
  const cueStartFrame = cue ? Math.round(cue.start * fps) : 0;
  const cueIn = interpolate(frame - cueStartFrame, [0, 6], [0, 1], CLAMP);
  // 蘇り防止: cue開始後に全画面カード(字幕非表示シーン)が始まっていたら、そのcueは
  // カードの向こうで役目を終えている。カード明け〜次cueの隙間に一瞬だけ再表示しない
  // (字幕・ジェスチャー・表情ともliveCueを見る)
  const CUE_HIDING_TYPES = ['typo', 'cta', 'number', 'split', 'manga'];
  const cueDead =
    cue !== null &&
    scenes.some(
      (s) => CUE_HIDING_TYPES.includes(s.type) && s.start > cue.start && s.start <= t
    );
  const liveCue = cueDead ? null : cue;

  // カット割り: start <= t の最後のシーン。カット頭はパンチイン(1.05→1.0)
  let sceneIndex = -1;
  for (let i = 0; i < scenes.length; i++) {
    if (scenes[i].start <= t) sceneIndex = i;
  }
  const scene: Scene = sceneIndex >= 0 ? scenes[sceneIndex] : { start: 0, type: 'avatar', zoom: 1 };
  const sceneStartFrame = Math.round(scene.start * fps);
  const punch = interpolate(frame - sceneStartFrame, [0, 7], [scene.punch ?? 1.05, 1], CLAMP);
  const isAvatarScene = scene.type === 'avatar' || scene.type === 'cta';
  const isHookCard = scene.type === 'number' || scene.type === 'split' || scene.type === 'manga';
  // 和紙背景のときだけ墨と深金に落とす(明地に白文字・明アクセントは沈むため)
  const hookInk = scene.bg === 'washi' ? '#2a251c' : INK;
  const hookAccent = scene.bg === 'washi' ? '#8a6a2f' : ACCENT;
  // じりじり微振動(静止素材の「止まってる感」を消す)
  const jitterX = scene.jitter ? Math.sin(frame * 2.9) * 1.8 : 0;
  const jitterY = scene.jitter ? Math.cos(frame * 3.7) * 1.4 : 0;
  // カット頭の白フラッシュ(1発・4Fで減衰)
  const flashOpacity = scene.flash
    ? interpolate(frame - sceneStartFrame, [0, 4], [0.92, 0], CLAMP)
    : 0;

  // どどどのドンに同期した減衰シェイク(どどど付きタイポカットのみ)
  let shakeAmp = 0;
  if (scene.type === 'typo' && scene.text && scene.text.includes('|')) {
    const chunkCount = scene.text.split(/[\n|]/).filter((c) => c.trim().length > 0).length;
    for (let i = 0; i < chunkCount; i++) {
      const dt = frame - (sceneStartFrame + i * 7);
      if (dt >= 0 && dt < 5) shakeAmp = Math.max(shakeAmp, (5 - dt) * 1.5);
    }
  }
  const shakeX = shakeAmp ? (frame % 2 === 0 ? 1 : -1) * shakeAmp : 0;

  // Ken Burns: シーン全長でゆっくりズーム・パン(静止画を動画風に)
  const sceneEndFrame =
    sceneIndex >= 0 && sceneIndex < scenes.length - 1
      ? Math.round(scenes[sceneIndex + 1].start * fps)
      : durationInFrames;
  const kbProg = interpolate(frame, [sceneStartFrame, sceneEndFrame], [0, 1], CLAMP);
  const kb = scene.kb ?? { from: [1.08, 0, 0] as const, to: [1.18, 0, 0] as const };
  const kbScale = kb.from[0] + (kb.to[0] - kb.from[0]) * kbProg;
  const kbX = kb.from[1] + (kb.to[1] - kb.from[1]) * kbProg;
  const kbY = kb.from[2] + (kb.to[2] - kb.from[2]) * kbProg;
  const hookEndFrame = Math.round((scenes.length > 1 ? scenes[1].start : 4.5) * fps);
  const titleOut = interpolate(frame, [hookEndFrame - 8, hookEndFrame], [1, 0], CLAMP);

  const raw = audioData ? visualizeAudio({ fps, frame, audioData, numberOfSamples: 32 }) : null;
  const low = raw
    ? raw.slice(1, 25).map((v) => Math.min(1, Math.pow(v * 1.9, 1.35)))
    : new Array(24).fill(0.06);
  const bars = [...low.slice().reverse(), ...low];

  // 口パク: 音声波形の生RMS(1.5フレーム窓)→開き0..1。
  // 閾値の初期値は目安(無音0.001未満/発話中央値0.03前後を想定)。素材で要キャリブレーション
  const mouthOpen = (() => {
    if (!audioData) return 0;
    const wave = audioData.channelWaveforms[0];
    const sr = audioData.sampleRate;
    const center = Math.floor((frame / fps) * sr);
    const half = Math.floor((sr / fps) * 0.75);
    let s = 0;
    let n = 0;
    for (let i = Math.max(0, center - half); i < Math.min(wave.length, center + half); i++) {
      s += wave[i] * wave[i];
      n++;
    }
    const rms = n ? Math.sqrt(s / n) : 0;
    return Math.min(1, Math.max(0, (rms - 0.006) / 0.11));
  })();
  const MSC = character.mouthScale ?? 1;
  const ESC = character.eyeScale ?? 1;
  const mw = (54 + mouthOpen * 46) * MSC;
  const mh = (7 + mouthOpen * 56) * MSC;
  const mx0 = M.cx - mw / 2;
  const mx1 = M.cx + mw / 2;
  const myB = M.top + mh;
  const closedY = M.top + 10; // 閉じ口(微笑線)の基準線
  const closedDip = M.top + 22;

  // 表情: チャンネル方式(各表情の強度0..1)。cueのmoodへ6フレームでクロスフェード遷移
  //   smile/laugh=にっこり / stern=気難しい / sad=悲しい / serious=真顔 / wink=ウインク
  type MoodCh = { smile: number; stern: number; sad: number; serious: number; wink: number };
  const moodCh = (m?: Cue['mood']): MoodCh => ({
    smile: m === 'laugh' ? 1 : m === 'smile' ? 0.6 : m === 'wink' ? 0.25 : 0,
    stern: m === 'stern' ? 1 : 0,
    sad: m === 'sad' ? 1 : 0,
    serious: m === 'serious' ? 1 : 0,
    wink: m === 'wink' ? 1 : 0,
  });
  const prevChv = moodCh(cueIndex > 0 ? cues[cueIndex - 1].mood : undefined);
  const curChv = moodCh(liveCue?.mood);
  const ctaChv = moodCh('smile'); // エンドカードはにっこり固定
  const ch = (k: keyof MoodCh) =>
    scene.type === 'cta' ? ctaChv[k] : prevChv[k] + (curChv[k] - prevChv[k]) * cueIn;
  const smileVal = ch('smile');
  const sternVal = ch('stern'); // 気難しさ(眉ひそめ・半目・への字)
  const sadVal = ch('sad'); // 悲しみ(八の字眉・への字)
  const seriousVal = ch('serious'); // 真顔(直線口・フラット眉)
  const winkVal = ch('wink'); // ウインク(片目∩)
  const smileEyes = smileVal > 0.3;
  const arch = smileVal * 16; // 笑い口の上辺の上凸
  const corner = smileVal * 8 - sternVal * 14 - sadVal * 10; // 口角(正=上がる/負=への字)

  // 瞬き: 97フレーム周期で4フレーム閉じる(にっこり目・半目・ウインク中は休止)
  const bp = frame % 97;
  const blink = !smileEyes && sternVal < 0.3 && winkVal < 0.3 && bp >= 90 && bp < 94;

  // 息づかい(笑い中は小刻みに弾む)
  const float = Math.sin(t * 1.4) * 8;
  const sway = Math.sin(t * 0.9) * 1.2;
  const jiggle = smileVal > 0.8 ? Math.sin(t * 15) * 2.5 : 0;
  const bob = -mouthOpen * 6 + jiggle;

  // ジェスチャー: cue区間はポーズ差分に切替(2値)。頷きはcue頭18Fで2回こくこく
  const gesture = liveCue?.gesture;
  const nodT = interpolate(frame - cueStartFrame, [0, 18], [0, 1], CLAMP);
  // エンドカードでは開始10Fからおじぎを1回打つ
  const ctaNodT = interpolate(frame - sceneStartFrame, [10, 30], [0, 1], CLAMP);
  const ctaNodAmp = scene.type === 'cta' ? Math.abs(Math.sin(ctaNodT * Math.PI * 2)) : 0;
  const nodAmp = (gesture === 'nod' ? Math.abs(Math.sin(nodT * Math.PI * 2)) : 0) + ctaNodAmp;
  const nodAngle = nodAmp * 2.5;
  const nodDip = nodAmp * 7;

  const titleIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });

  // ポーズ差分: 対応画像が無ければ通常胴体へフォールバック(ジェスチャーは静かに無効化)
  const bodySrc =
    gesture === 'point' && character.images.bodyPoint
      ? character.images.bodyPoint
      : gesture === 'open' && character.images.bodyOpen
        ? character.images.bodyOpen
        : character.images.body;

  // 瞼パッチ: 専用画像があれば使う。無ければ楕円塗り(eyePatch)で白目を隠す
  const eyePatch = character.eyePatch ?? { rx: 42, ry: 30, color: '#fdedd3' };
  // 表情ベクター微調整: 線幅とアンカー点オフセット(inner=顔中心向きの座標系で左右対称に適用)
  const FT = character.faceTune ?? {};
  type FTKey = 'smileEye' | 'blinkLine' | 'sternBrow' | 'sternLid' | 'sadBrow' | 'seriousBrow' | 'winkArc' | 'closedMouth';
  const ftW = (k: FTKey, d: number) => FT[k]?.w ?? d;
  const ftP = (k: FTKey, i: number): [number, number] => {
    const p = FT[k]?.p?.[i];
    return [p?.[0] ?? 0, p?.[1] ?? 0];
  };
  // 眉の2層描画: 縁(browLineColor)を太く敷いた上に中の色(browColor)を重ねる
  const browFillC = character.browColor ?? M.line;
  const browLineC = character.browLineColor;
  const browLW = character.browLineWidth ?? 3;
  const Brow = ({ d, w }: { d: string; w: number }) => (
    <g>
      {browLineC ? (
        <path d={d} stroke={browLineC} strokeWidth={w + browLW * 2} fill="none" strokeLinecap="round" />
      ) : null}
      <path d={d} stroke={browFillC} strokeWidth={w} fill="none" strokeLinecap="round" />
    </g>
  );
  const lidCover = blink || smileEyes;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        fontFamily: FONT,
        transform: shakeX ? `translateX(${shakeX}px)` : undefined,
      }}
    >
      <Audio src={staticFile(audioSrc)} />

      {/* BGM: 薄く敷き、声量に応じて自動ダッキング */}
      {bgmSrc ? <Audio loop src={staticFile(bgmSrc)} volume={0.16 - mouthOpen * 0.08} /> : null}

      {/* SE: タイポの「どどど」に同期してドンを打つ */}
      {scenes
        .filter(
          (s) => (s.type === 'typo' || s.type === 'cta') && s.text && s.text.includes('|')
        )
        .map((s, si) => {
          const base = Math.round(s.start * fps);
          const chunks = s.text!.split(/[\n|]/).filter((c) => c.trim().length > 0).length;
          return Array.from({ length: chunks }, (_, i) => (
            <Sequence key={`se-${si}-${i}`} from={base + i * 7} durationInFrames={20}>
              <Audio src={staticFile(seDonSrc)} volume={0.45} />
            </Sequence>
          ));
        })}

      {/* SE: フックカード(number/split/manga)とslamはカット頭にドン1発 */}
      {scenes
        .filter(
          (s) => ['number', 'split', 'manga'].includes(s.type) || (s.type === 'typo' && s.slam)
        )
        .map((s, si) => (
          <Sequence key={`se-hook-${si}`} from={Math.round(s.start * fps)} durationInFrames={20}>
            <Audio src={staticFile(seDonSrc)} volume={0.5} />
          </Sequence>
        ))}

      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 90% 55% at 50% 40%, ${ACCENT}0f, transparent 60%)`,
        }}
      />

      {/* Bロールカット: 生成イメージ映像(cover+可読性グラデ) */}
      {scene.type === 'broll' && scene.videoSrc ? (
        <AbsoluteFill style={{ transform: `scale(${punch})` }}>
          <Loop durationInFrames={Math.round(fps * 4)}>
            <OffthreadVideo
              muted
              src={staticFile(scene.videoSrc)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </Loop>
          <AbsoluteFill
            style={{
              background:
                'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 28%, transparent 55%, rgba(0,0,0,0.78) 88%)',
            }}
          />
        </AbsoluteFill>
      ) : null}

      {/* 動画背景つきタイポ(動画先行フック): 動画を敷いてでか文字を乗せる */}
      {scene.type === 'typo' && scene.videoSrc ? (
        <AbsoluteFill style={{ transform: `scale(${punch})` }}>
          <Loop durationInFrames={Math.round(fps * 4)}>
            <OffthreadVideo
              muted
              src={staticFile(scene.videoSrc)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </Loop>
          <AbsoluteFill style={{ background: `rgba(0,0,0,${scene.dim ?? 0.42})` }} />
        </AbsoluteFill>
      ) : null}

      {/* 背景プリセット(透過決め絵・タイポの下敷き) */}
      {/* bg未指定の素のtypoは画面が空白に見える(実測FB)→monoを安全網に。素材の意味でbgを明示指定するのが正 */}
      {scene.type === 'typo' && !scene.bg && !scene.src && !scene.videoSrc ? (
        <HookBackground bg="mono" theme={theme} />
      ) : null}
      {(scene.type === 'typo' || isHookCard) && scene.bg ? (
        <HookBackground bg={scene.bg} theme={theme} />
      ) : null}

      {/* 透過決め絵: 背景プリセットの上に据える(下端アンカー・contain) */}
      {scene.type === 'typo' && scene.bg && scene.src ? (
        <AbsoluteFill style={{ transform: `scale(${punch})` }}>
          <Img
            src={staticFile(scene.src)}
            style={{
              position: 'absolute',
              left: '50%',
              bottom: 0,
              height: 860,
              transform: `translateX(-50%) ${scene.mirror ? 'scaleX(-1) ' : ''}scale(${kbScale}) translate(${kbX + jitterX}px, ${kbY + jitterY}px)`,
              transformOrigin: '50% 100%',
            }}
          />
        </AbsoluteFill>
      ) : null}

      {/* 静止画カット: Ken Burnsで動画風に(typoの写真背景も兼ねる) */}
      {(scene.type === 'still' || scene.type === 'typo') && scene.src && !scene.bg ? (
        <AbsoluteFill style={{ overflow: 'hidden', transform: `scale(${punch})` }}>
          <Img
            src={staticFile(scene.src)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `${scene.mirror ? 'scaleX(-1) ' : ''}scale(${kbScale}) translate(${kbX + jitterX}px, ${kbY + jitterY}px)`,
            }}
          />
          <AbsoluteFill
            style={{
              background:
                scene.type === 'typo'
                  ? `rgba(0,0,0,${scene.dim ?? 0.5})`
                  : 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 28%, transparent 55%, rgba(0,0,0,0.78) 88%)',
            }}
          />
        </AbsoluteFill>
      ) : null}

      {/* 巨大数字フック: 数字が主役・キャラは下端で反応役 */}
      {scene.type === 'number' ? (
        <AbsoluteFill style={{ transform: `scale(${punch})` }}>
          {scene.numLabel ? (
            <div
              style={{
                position: 'absolute',
                top: 400,
                width: '100%',
                textAlign: 'center',
                fontSize: 78,
                fontWeight: 800,
                color: hookInk,
                lineHeight: 1.3,
                whiteSpace: 'pre-line',
              }}
            >
              {renderRich(scene.numLabel, hookAccent)}
            </div>
          ) : null}
          <div
            style={{
              position: 'absolute',
              top: 620,
              width: '100%',
              textAlign: 'center',
              fontSize:
                (scene.num ?? '').length >= 6 ? 175 : (scene.num ?? '').length >= 4 ? 235 : 300,
              fontWeight: 900,
              lineHeight: 1.05,
              whiteSpace: 'nowrap',
              color: hookAccent,
              textShadow: scene.bg === 'washi' ? 'none' : '0 12px 70px rgba(0,0,0,0.5)',
              opacity: interpolate(frame - sceneStartFrame, [0, 2], [0, 1], CLAMP),
              transform: `scale(${
                interpolate(frame - sceneStartFrame, [0, 5], [2.7, 0.95], CLAMP) *
                interpolate(frame - sceneStartFrame, [5, 9], [0.99, 1.04], CLAMP)
              })`,
            }}
          >
            {scene.num}
          </div>
          {scene.text ? (
            <div
              style={{
                position: 'absolute',
                top: 1030,
                width: '100%',
                textAlign: 'center',
                fontSize: 88,
                fontWeight: 800,
                color: hookInk,
                lineHeight: 1.3,
                whiteSpace: 'pre-line',
              }}
            >
              {scene.slam
                ? renderSlam(scene.text, frame, sceneStartFrame + 8, hookAccent)
                : renderRich(scene.text, hookAccent, {
                    frame,
                    startFrame: sceneStartFrame + 8,
                    interval: 7,
                    popFrames: 5,
                  })}
            </div>
          ) : null}
          {character.images.hookBase ? (
            <Img
              src={staticFile(character.images.hookBase)}
              style={{
                position: 'absolute',
                left: '50%',
                bottom: 140,
                height: 350,
                opacity: interpolate(frame - sceneStartFrame, [8, 14], [0, 1], CLAMP),
                transform: `translateX(-50%) translateY(${interpolate(
                  frame - sceneStartFrame,
                  [8, 14],
                  [70, 0],
                  CLAMP
                )}px)`,
              }}
            />
          ) : null}
        </AbsoluteFill>
      ) : null}

      {/* 対比2分割フック: 斜め分割+アクセント界線+ラベル */}
      {scene.type === 'split' && scene.src && scene.srcB ? (
        <AbsoluteFill style={{ transform: `scale(${punch})`, background: BG }}>
          <AbsoluteFill
            style={{
              clipPath: 'polygon(0 0,100% 0,100% 40%,0 64%)',
              transform: `translateX(${interpolate(frame - sceneStartFrame, [0, 7], [-90, 0], CLAMP)}px)`,
            }}
          >
            <Img
              src={staticFile(scene.src)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <AbsoluteFill style={{ background: 'rgba(0,0,0,0.3)' }} />
          </AbsoluteFill>
          <AbsoluteFill
            style={{
              clipPath: 'polygon(0 64%,100% 40%,100% 100%,0 100%)',
              transform: `translateX(${interpolate(frame - sceneStartFrame, [0, 7], [90, 0], CLAMP)}px)`,
            }}
          >
            <Img
              src={staticFile(scene.srcB)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <AbsoluteFill style={{ background: 'rgba(0,0,0,0.42)' }} />
          </AbsoluteFill>
          <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
            <line x1={0} y1={1080 * 0.64} x2={1920} y2={1080 * 0.4} stroke={ACCENT} strokeWidth={10} />
          </svg>
          {scene.labelA ? (
            <div
              style={{
                position: 'absolute',
                top: 210,
                left: 64,
                padding: '18px 34px',
                background: 'rgba(0,0,0,0.78)',
                border: `2px solid ${ACCENT}`,
                borderRadius: 14,
                fontSize: 64,
                fontWeight: 800,
                color: INK,
                whiteSpace: 'pre-line',
                lineHeight: 1.3,
              }}
            >
              {renderRich(scene.labelA, ACCENT)}
            </div>
          ) : null}
          {scene.labelB ? (
            <div
              style={{
                position: 'absolute',
                bottom: 420,
                right: 64,
                padding: '18px 34px',
                background: 'rgba(0,0,0,0.78)',
                border: `2px solid ${ACCENT}`,
                borderRadius: 14,
                fontSize: 64,
                fontWeight: 800,
                color: INK,
                whiteSpace: 'pre-line',
                lineHeight: 1.3,
                textAlign: 'right',
                opacity: interpolate(frame - sceneStartFrame, [6, 11], [0, 1], CLAMP),
              }}
            >
              {renderRich(scene.labelB, ACCENT)}
            </div>
          ) : null}
        </AbsoluteFill>
      ) : null}

      {/* 漫画コマフック: 白パネル×黒枠×集中線×吹き出し */}
      {scene.type === 'manga' && scene.src ? (
        <AbsoluteFill style={{ transform: `scale(${punch})` }}>
          {!scene.bg ? <HookBackground bg="mono" theme={theme} /> : null}
          <div
            style={{
              position: 'absolute',
              left: 250,
              right: 250,
              top: 110,
              height: 800,
              background: '#ffffff',
              border: '12px solid #141414',
              boxShadow: '0 30px 90px rgba(0,0,0,0.55)',
              overflow: 'hidden',
              transform: `rotate(-1.6deg) scale(${interpolate(
                frame - sceneStartFrame,
                [0, 6],
                [1.08, 1],
                CLAMP
              )})`,
            }}
          >
            <svg width={1420} height={800} style={{ position: 'absolute', inset: 0 }}>
              {Array.from({ length: 36 }, (_, i) => {
                const a = (i / 36) * Math.PI * 2;
                const reach = 0.55 + 0.14 * Math.abs(Math.sin(i * 5.17));
                const scx = 710;
                const scy = 400;
                const rO = 900;
                const rI = rO * reach;
                return (
                  <line
                    key={i}
                    x1={scx + Math.cos(a) * rO}
                    y1={scy + Math.sin(a) * rO}
                    x2={scx + Math.cos(a) * rI}
                    y2={scy + Math.sin(a) * rI}
                    stroke="#141414"
                    strokeWidth={3.5}
                    opacity={0.85}
                  />
                );
              })}
            </svg>
            <Img
              src={staticFile(scene.src)}
              style={{
                position: 'absolute',
                left: '50%',
                bottom: -20,
                height: '76%',
                transform: 'translateX(-50%)',
              }}
            />
            {scene.text ? (
              <div
                style={{
                  position: 'absolute',
                  top: 42,
                  left: 46,
                  right: 46,
                  background: '#ffffff',
                  border: '8px solid #141414',
                  borderRadius: 54,
                  padding: '30px 26px',
                  fontSize: 54,
                  fontWeight: 800,
                  color: '#141414',
                  textAlign: 'center',
                  lineHeight: 1.32,
                  whiteSpace: 'pre-line',
                }}
              >
                {scene.slam
                  ? renderSlam(scene.text, frame, sceneStartFrame + 4, '#c02f2f')
                  : renderRich(scene.text, '#c02f2f')}
                <div
                  style={{
                    position: 'absolute',
                    bottom: -34,
                    left: 130,
                    width: 44,
                    height: 44,
                    background: '#ffffff',
                    borderRight: '8px solid #141414',
                    borderBottom: '8px solid #141414',
                    transform: 'rotate(55deg) skewX(18deg)',
                  }}
                />
              </div>
            ) : null}
          </div>
        </AbsoluteFill>
      ) : null}

      {/* タイポカット: でか文字1枚 */}
      {/* 上寄せ(top/middle)は下に決め絵・写真・動画があるときだけ。純テキストカードで上寄せすると
          集中線背景の焦点(中央)が空いて見える(実測FB)→art無しは常に縦センター */}
      {scene.type === 'typo' && scene.text ? (
        <AbsoluteFill
          style={{
            justifyContent:
              (scene.textPos === 'top' || scene.textPos === 'middle') &&
              (scene.src || scene.videoSrc)
                ? 'flex-start'
                : 'center',
            alignItems: 'center',
            paddingTop:
              scene.src || scene.videoSrc
                ? scene.textPos === 'top'
                  ? 64
                  : scene.textPos === 'middle'
                    ? 200
                    : 0
                : 0,
            transform: `scale(${punch})`,
          }}
        >
          <div
            style={{
              fontSize: scene.textPos === 'top' ? 90 : scene.textPos === 'middle' ? 84 : 110,
              fontWeight: 800,
              color: hookInk,
              textAlign: 'center',
              lineHeight: scene.textPos === 'middle' ? 1.2 : 1.34,
              padding: '0 44px',
              boxSizing: 'border-box',
              whiteSpace: 'pre-line',
              textShadow: scene.bg === 'washi' ? 'none' : '0 4px 40px rgba(0,0,0,0.6)',
            }}
          >
            {scene.slam
              ? renderSlam(scene.text, frame, sceneStartFrame, hookAccent)
              : renderRich(scene.text, hookAccent, {
                  frame,
                  startFrame: sceneStartFrame,
                  interval: 7,
                  popFrames: 5,
                })}
          </div>
        </AbsoluteFill>
      ) : null}

      {/* タイトル(空文字なら非表示=フックのタイポが兼ねる) */}
      {title ? (
        <div
          style={{
            position: 'absolute',
            top: 110,
            width: '100%',
            padding: '0 84px',
            boxSizing: 'border-box',
            textAlign: 'center',
            color: INK,
            fontSize: 60,
            fontWeight: 800,
            lineHeight: 1.32,
            whiteSpace: 'pre-line',
            opacity: titleIn * titleOut,
            transform: `translateY(${(1 - titleIn) * 14}px)`,
          }}
        >
          {renderRich(title, ACCENT)}
        </div>
      ) : null}

      {/* エンドカードCTA: アバターの上にでか文字 */}
      {scene.type === 'cta' && scene.text ? (
        <div
          style={{
            position: 'absolute',
            top: 96,
            width: '100%',
            textAlign: 'center',
            fontSize: 84,
            fontWeight: 800,
            color: INK,
            lineHeight: 1.35,
            whiteSpace: 'pre-line',
            textShadow: '0 4px 40px rgba(0,0,0,0.6)',
            transform: `scale(${punch})`,
          }}
        >
          {renderRich(scene.text, ACCENT, {
            frame,
            startFrame: sceneStartFrame,
            interval: 7,
            popFrames: 5,
          })}
        </div>
      ) : null}

      {/* 後光リング+キャラ+影(アバターカットのみ・zoomで寄り引き) */}
      {isAvatarScene ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `translateY(${float}px) scale(${(scene.zoom ?? 1) * punch})`,
            transformOrigin: `960px ${Math.round(CHAR_TOP + DISP_H * 0.54)}px`,
          }}
        >
          {/* 接地影: 浮くほど小さく薄く */}
          <div
            style={{
              position: 'absolute',
              top: SHADOW_TOP,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 290 - float * 5,
              height: 32,
              borderRadius: '50%',
              background: `rgba(0,0,0,${0.42 - float * 0.012})`,
              filter: 'blur(14px)',
            }}
          />

          {/* 後光リング(声に反応して伸びる) */}
          <svg
            width={1920}
            height={1000}
            style={{ position: 'absolute', top: RING_CY - 500, left: 0 }}
          >
            {bars.map((v, i) => {
              const a = (i / bars.length) * Math.PI * 2 - Math.PI / 2;
              const r0 = RING_R;
              const r1 = r0 + 12 + v * 64;
              return (
                <line
                  key={i}
                  x1={960 + Math.cos(a) * r0}
                  y1={500 + Math.sin(a) * r0}
                  x2={960 + Math.cos(a) * r1}
                  y2={500 + Math.sin(a) * r1}
                  stroke={ACCENT}
                  strokeWidth={7}
                  strokeLinecap="round"
                  opacity={0.28 + v * 0.62}
                />
              );
            })}
          </svg>

          {/* キャラ本体(ネイティブ座標で組んでscale) */}
          <div
            style={{
              position: 'absolute',
              top: CHAR_TOP,
              left: 960 - DISP_W / 2,
              width: DISP_W,
              height: DISP_H,
              transform: `rotate(${sway}deg) translateY(${bob}px)`,
              transformOrigin: '50% 92%',
            }}
          >
            <div
              style={{
                width: CW,
                height: CH,
                transform: `scale(${SCALE})`,
                transformOrigin: '0 0',
                position: 'relative',
              }}
            >
              {/* 胴体: 通常かポーズ差分のどちらか一方だけを表示(重ね透け禁止) */}
              <Img
                src={staticFile(bodySrc)}
                style={{ position: 'absolute', inset: 0, width: CW, height: CH }}
              />

              {/* 頭グループ: 頷きで顔パーツごと動く */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  transform: `rotate(${nodAngle}deg) translateY(${nodDip}px)`,
                  transformOrigin: `${character.headPivot.x}px ${character.headPivot.y}px`,
                }}
              >
                <Img
                  src={staticFile(character.images.head)}
                  style={{ position: 'absolute', inset: 0, width: CW, height: CH }}
                />
                {/* 瞼: 専用パッチ画像 or 楕円塗りで白目を隠してから線を描く */}
                {lidCover && character.images.eyeLid ? (
                  <Img
                    src={staticFile(character.images.eyeLid)}
                    style={{ position: 'absolute', inset: 0, width: CW, height: CH }}
                  />
                ) : null}
                <svg width={CW} height={CH} style={{ position: 'absolute', inset: 0 }}>
                  {/* 元絵の口・目を隠す肌色カバー(最背面) */}
                  {character.covers?.map((cv, i) => {
                    // show:'brow' は眉表情(stern/sad/serious)の強度に連動して表示(元絵の眉を隠す)
                    const browAmt = Math.max(sternVal, sadVal, seriousVal);
                    const op = cv.show === 'brow' ? browAmt : 1;
                    if (op < 0.02) return null;
                    return (
                      <ellipse
                        key={`cover-${i}`}
                        cx={cv.cx}
                        cy={cv.cy}
                        rx={cv.rx}
                        ry={cv.ry}
                        fill={cv.color}
                        opacity={op}
                        transform={cv.rot ? `rotate(${cv.rot} ${cv.cx} ${cv.cy})` : undefined}
                      />
                    );
                  })}
                  {lidCover && !character.images.eyeLid ? (
                    <g>
                      {EYES.map((e, i) => (
                        <ellipse
                          key={i}
                          cx={e.cx}
                          cy={e.cy}
                          rx={eyePatch.rx}
                          ry={eyePatch.ry}
                          fill={eyePatch.color}
                        />
                      ))}
                    </g>
                  ) : null}

                  {/* 頬紅: 表情に連動してふわっと */}
                  {character.cheeks && smileVal > 0.05 ? (
                    <g opacity={smileVal * 0.5}>
                      {character.cheeks.map((c, i) => (
                        <ellipse
                          key={i}
                          cx={c.cx}
                          cy={c.cy}
                          rx={27}
                          ry={14}
                          fill={character.cheekColor ?? '#ef9aa2'}
                        />
                      ))}
                    </g>
                  ) : null}

                  {/* 口: 閉じ=微笑線 / 開き=D型+舌。moodで口角と上凸が上がり笑い口に */}
                  {mouthOpen < 0.1 ? (
                    <path
                      d={(() => {
                        // 閉じ口: smile=下弧が深まる / stern・sad=への字 / serious=直線へ寄せる
                        const halfW = (26 + smileVal * 8 - (sternVal + sadVal) * 8) * MSC;
                        const ctrl0 = closedDip + smileVal * 8 - sternVal * 14 - sadVal * 10;
                        const ctrlY = ctrl0 + (closedY - corner - ctrl0) * seriousVal;
                        return `M ${M.cx - halfW} ${closedY - corner} Q ${M.cx} ${ctrlY} ${M.cx + halfW} ${closedY - corner}`;
                      })()}
                      stroke={M.line}
                      strokeWidth={ftW('closedMouth', 7)}
                      fill="none"
                      strokeLinecap="round"
                    />
                  ) : (
                    <g>
                      <path
                        d={`M ${mx0} ${M.top + 4 - corner} Q ${M.cx} ${M.top - arch} ${mx1} ${M.top + 4 - corner} Q ${mx1} ${myB} ${M.cx} ${myB} Q ${mx0} ${myB} ${mx0} ${M.top + 4 - corner} Z`}
                        fill={M.fill}
                        stroke={M.line}
                        strokeWidth={6}
                        strokeLinejoin="round"
                      />
                      {/* 舌: 陽気さが出るのでstern・sad中は出さない */}
                      {mouthOpen > 0.4 && sternVal + sadVal < 0.5 ? (
                        <ellipse
                          cx={M.cx}
                          cy={myB - mh * 0.2}
                          rx={mw * 0.3}
                          ry={mh * 0.18}
                          fill={M.tongue}
                        />
                      ) : null}
                    </g>
                  )}

                  {/* にっこり目: 笑い/微笑中は∩の弧 */}
                  {smileEyes ? (
                    <g>
                      {EYES.map((e, i) => (
                        <path
                          key={i}
                          d={(() => {
                            const inner = e.cx < M.cx ? 1 : -1;
                            const [a0, b0] = ftP('smileEye', 0);
                            const [a1, b1] = ftP('smileEye', 1);
                            const [a2, b2] = ftP('smileEye', 2);
                            return `M ${e.cx - inner * (40 * ESC - a0)} ${e.cy + 14 * ESC + b0} Q ${e.cx + inner * a1} ${e.cy - (18 + smileVal * 16) * ESC + b1} ${e.cx + inner * (40 * ESC + a2)} ${e.cy + 14 * ESC + b2}`;
                          })()}
                          stroke={M.line}
                          strokeWidth={ftW('smileEye', 10)}
                          fill="none"
                          strokeLinecap="round"
                        />
                      ))}
                    </g>
                  ) : null}

                  {/* 瞬き: 下向きの弧線 */}
                  {blink ? (
                    <g>
                      {EYES.map((e, i) => (
                        <path
                          key={i}
                          d={(() => {
                            const inner = e.cx < M.cx ? 1 : -1;
                            const [a0, b0] = ftP('blinkLine', 0);
                            const [a1, b1] = ftP('blinkLine', 1);
                            const [a2, b2] = ftP('blinkLine', 2);
                            return `M ${e.cx - inner * (38 * ESC - a0)} ${e.cy + 2 + b0} Q ${e.cx + inner * a1} ${e.cy + 30 * ESC + b1} ${e.cx + inner * (38 * ESC + a2)} ${e.cy + 2 + b2}`;
                          })()}
                          stroke={M.line}
                          strokeWidth={ftW('blinkLine', 9)}
                          fill="none"
                          strokeLinecap="round"
                        />
                      ))}
                    </g>
                  ) : null}

                  {/* 気難しい顔(stern): 眉ひそめ+半目。mood負側で発動(素材追加なしのコード描画) */}
                  {sternVal > 0.05 && !smileEyes && !blink ? (
                    <g opacity={sternVal}>
                      {EYES.map((e, i) => {
                        const inner = e.cx < M.cx ? 1 : -1; // 顔中心へ向かう向き
                        const lidY = e.cy - 22 + 16 * sternVal; // 半目: 上まぶたの下端
                        const outerX = e.cx - inner * 38;
                        const innerX = e.cx + inner * 38;
                        return (
                          <g key={i}>
                            {/* 上まぶたパッチ: 目の上半分を肌色で隠す */}
                            <path
                              d={`M ${outerX} ${lidY - 5} Q ${e.cx} ${lidY - 56} ${innerX} ${lidY + 5} Z`}
                              fill={eyePatch.color}
                            />
                            {/* まぶた線(内側が下がる) */}
                            <path
                              d={`M ${outerX} ${lidY - 5} L ${innerX} ${lidY + 5}`}
                              stroke={M.line}
                              strokeWidth={ftW('sternLid', 9)}
                              strokeLinecap="round"
                            />
                            {/* 眉ひそめ(内側が下がる・遷移でずり下がる) */}
                            <Brow
                              w={ftW('sternBrow', 11)}
                              d={(() => {
                                const lift = (1 - sternVal) * -10;
                                const [a0, b0] = ftP('sternBrow', 0);
                                const [a1, b1] = ftP('sternBrow', 1);
                                const [a2, b2] = ftP('sternBrow', 2);
                                return `M ${e.cx - inner * (44 * ESC - a0)} ${e.cy - 74 + lift + b0} Q ${e.cx + inner * a1} ${e.cy - 68 + lift + b1} ${e.cx + inner * (38 * ESC + a2)} ${e.cy - 54 + lift + b2}`;
                              })()}
                            />
                          </g>
                        );
                      })}
                    </g>
                  ) : null}

                  {/* 悲しい顔(sad): 八の字眉(内側が上がる)。口のへの字はcorner側で連動 */}
                  {sadVal > 0.05 && !smileEyes && !blink ? (
                    <g opacity={sadVal}>
                      {EYES.map((e, i) => {
                        const inner = e.cx < M.cx ? 1 : -1;
                        const lift = (1 - sadVal) * -10; // 遷移でふわっと上がる
                        return (
                          <Brow
                            key={i}
                            w={ftW('sadBrow', 11)}
                            d={(() => {
                              const [a0, b0] = ftP('sadBrow', 0);
                              const [a1, b1] = ftP('sadBrow', 1);
                              const [a2, b2] = ftP('sadBrow', 2);
                              return `M ${e.cx - inner * (42 * ESC - a0)} ${e.cy - 52 + lift + b0} Q ${e.cx - inner * 4 + inner * a1} ${e.cy - 62 + lift + b1} ${e.cx + inner * (34 * ESC + a2)} ${e.cy - 74 + lift + b2}`;
                            })()}
                          />
                        );
                      })}
                    </g>
                  ) : null}

                  {/* 真顔(serious): フラット眉。口の直線化はctrlY側で連動 */}
                  {seriousVal > 0.05 && !smileEyes && !blink ? (
                    <g opacity={seriousVal * 0.9}>
                      {EYES.map((e, i) => {
                        const inner = e.cx < M.cx ? 1 : -1;
                        return (
                          <Brow
                            key={i}
                            w={ftW('seriousBrow', 10)}
                            d={(() => {
                              const [a0, b0] = ftP('seriousBrow', 0);
                              const [a1, b1] = ftP('seriousBrow', 1);
                              const [a2, b2] = ftP('seriousBrow', 2);
                              // 中央に制御点を持つ浅いカーブ(初期は直線相当。b1で反り具合を調整)
                              return `M ${e.cx - inner * (42 * ESC - a0)} ${e.cy - 68 + b0} Q ${e.cx + inner * a1} ${e.cy - 66 + b1} ${e.cx + inner * (38 * ESC + a2)} ${e.cy - 64 + b2}`;
                            })()}
                          />
                        );
                      })}
                    </g>
                  ) : null}

                  {/* ウインク(wink): 向かって右目だけ∩に(左目は通常のまま) */}
                  {winkVal > 0.4 && !smileEyes && !blink && EYES.length > 1 ? (
                    <g>
                      <ellipse
                        cx={EYES[1].cx}
                        cy={EYES[1].cy}
                        rx={eyePatch.rx}
                        ry={eyePatch.ry}
                        fill={eyePatch.color}
                      />
                      <path
                        d={(() => {
                          const e = EYES[1];
                          const inner = e.cx < M.cx ? 1 : -1;
                          const [a0, b0] = ftP('winkArc', 0);
                          const [a1, b1] = ftP('winkArc', 1);
                          const [a2, b2] = ftP('winkArc', 2);
                          return `M ${e.cx - inner * (38 * ESC - a0)} ${e.cy + 6 + b0} Q ${e.cx + inner * a1} ${e.cy - 22 * ESC + b1} ${e.cx + inner * (38 * ESC + a2)} ${e.cy + 6 + b2}`;
                        })()}
                        stroke={M.line}
                        strokeWidth={ftW('winkArc', 10)}
                        fill="none"
                        strokeLinecap="round"
                      />
                    </g>
                  ) : null}
                </svg>
              </div>

              {/* 指差しの手だけ頭より手前に出す(手首の切り口は頭の裏に隠れる) */}
              {gesture === 'point' && character.images.handPoint ? (
                <Img
                  src={staticFile(character.images.handPoint)}
                  style={{ position: 'absolute', inset: 0, width: CW, height: CH }}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* 字幕ゾーン(タイポカット中は非表示=文字の二重を避ける)。
          bottom 430はIG/TikTokのUIセーフゾーンを空けるための値。動かすときはquality-gates参照 */}
      <div
        style={{
          position: 'absolute',
          bottom: 64,
          left: 48,
          right: 48,
          minHeight: 150,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}
      >
        {liveCue && scene.type !== 'typo' && scene.type !== 'cta' && !isHookCard ? (
          <div
            style={{
              textAlign: 'center',
              color: INK,
              fontSize: 62,
              fontWeight: 800,
              lineHeight: 1.38,
              // 横型はキャラや明るい静止画と重なるため座布団で可読性を確保
              background: 'rgba(6,8,12,0.6)',
              borderRadius: 18,
              padding: '10px 36px',
              textShadow: '0 2px 28px rgba(0,0,0,0.65)',
              opacity: liveCue.text.includes('|') ? 1 : cueIn,
              transform: liveCue.text.includes('|')
                ? undefined
                : `translateY(${(1 - cueIn) * 10}px)`,
            }}
          >
            {renderRich(liveCue.text, ACCENT, {
              frame,
              startFrame: cueStartFrame,
              interval: 4,
              popFrames: 4,
            })}
          </div>
        ) : null}
      </div>

      {/* 白フラッシュ(カット頭の1発) */}
      {flashOpacity > 0 ? (
        <AbsoluteFill
          style={{ background: '#ffffff', opacity: flashOpacity, pointerEvents: 'none' }}
        />
      ) : null}

      {/* AI音声開示(常設・小さく)。クローン/合成音声の回は必須 */}
      {aiVoiceLabel ? (
        <div
          style={{
            position: 'absolute',
            bottom: 22,
            right: 28,
            fontWeight: 600,
            fontSize: 25,
            // 和紙背景は白が沈むので墨色に落とす(AI開示は常時可読が掟)
            color: scene.bg === 'washi' ? 'rgba(42,37,28,0.62)' : 'rgba(255,255,255,0.55)',
            textShadow: scene.bg === 'washi' ? 'none' : '0 1px 6px rgba(0,0,0,0.6)',
            letterSpacing: 1,
          }}
        >
          {aiVoiceLabel}
        </div>
      ) : null}

      {/* プログレスバー */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: 8,
          backgroundColor: `${ACCENT}24`,
        }}
      >
        <div
          style={{
            width: `${(frame / durationInFrames) * 100}%`,
            height: '100%',
            backgroundColor: ACCENT,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
