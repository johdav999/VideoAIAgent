// Adapted from Leonxlnx/cinetic v1.0.0, MIT; see third_party/cinetic/LICENSE.
import React, {useEffect, useState} from 'react';
import {useDelayRender} from 'remotion';
import '../brand/fonts';
import {FACES} from '../brand/tokens';

export const FontGate: React.FC<{children: React.ReactNode}> = ({children}) => {
  const {delayRender, continueRender, cancelRender} = useDelayRender();
  const [handle] = useState(() => delayRender('Loading local brand fonts'));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    Promise.all(FACES.map((face) => document.fonts.load(face)))
      .then(() => document.fonts.ready)
      .then(() => {
        if (FACES.some((face) => !document.fonts.check(face)))
          throw new Error('A required local font did not load.');
        setReady(true);
        requestAnimationFrame(() => continueRender(handle));
      })
      .catch(cancelRender);
  }, [handle, continueRender, cancelRender]);
  return ready ? <>{children}</> : null;
};
