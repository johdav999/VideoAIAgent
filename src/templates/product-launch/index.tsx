import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {Film} from './Film';
import {FPS, H, TOTAL, W} from './timeline';
const Root: React.FC = () => (
  <Composition id="Film" component={Film} width={W} height={H} fps={FPS} durationInFrames={TOTAL} />
);
registerRoot(Root);
