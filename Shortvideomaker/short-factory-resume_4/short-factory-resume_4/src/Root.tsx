import React from 'react';
import { Composition } from 'remotion';
import { CharacterShort } from './CharacterShort';
import kuonChar from '../kuon-character.json';
import ukaChar from '../character.json';
import { CharacterShortWide } from './CharacterShortWide';
import * as kuon from './cues/saikishi-kuon';
import * as uka from './cues/uka-sora';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="saikishi-kuon"
      component={CharacterShort}
      durationInFrames={Math.round((47.3 + 3.0) * 30)}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        title: kuon.title,
        audioSrc: 'voice.wav',
        character: kuonChar,
        cues: kuon.cues,
        scenes: kuon.scenes,
        bgmSrc: 'bgm.wav',
        aiVoiceLabel: '声はAIで生成しています',
      }}
    />
    <Composition
      id="uka-sora"
      component={CharacterShort}
      durationInFrames={Math.round((56.3 + 3.0) * 30)}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        title: uka.title,
        audioSrc: 'voice-uka.m4a',
        character: ukaChar,
        cues: uka.cues,
        scenes: uka.scenes,
        bgmSrc: 'bgm-uka.wav',
        aiVoiceLabel: '声と画像の一部はAIで生成しています',
      }}
    />
    <Composition
      id="uka-sora-wide"
      component={CharacterShortWide}
      durationInFrames={Math.round((56.3 + 3.0) * 30)}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        title: uka.title,
        audioSrc: 'voice-uka.wav',
        character: ukaChar,
        cues: uka.cues,
        scenes: uka.scenes,
        bgmSrc: 'bgm-uka.wav',
        aiVoiceLabel: '声と画像の一部はAIで生成しています',
      }}
    />
  </>
);
