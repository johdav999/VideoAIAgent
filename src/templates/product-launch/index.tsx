import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {Film} from './Film';
import {FilmSub, subMetadata} from './FilmSub';
import {FPS, H, TOTAL, W} from './timeline';
const Root: React.FC = () => (
  <>
    <Composition
      id="Film"
      component={Film}
      width={W}
      height={H}
      fps={FPS}
      durationInFrames={TOTAL}
    />
    <Composition
      id="FilmSub"
      component={FilmSub}
      width={W}
      height={H}
      fps={FPS}
      durationInFrames={TOTAL}
      defaultProps={{groups: [] as number[]}}
      calculateMetadata={subMetadata}
    />
  </>
);
registerRoot(Root);
