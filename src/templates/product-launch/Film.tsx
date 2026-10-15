import React from 'react';
import {AbsoluteFill, Img, useCurrentFrame} from 'remotion';
import spec from './spec.json';
import {C, FONT} from './brand/tokens';
import {ACT, BEAT, FPS, H, TOTAL, W} from './timeline';
import {enter, unit} from './lib/anim';
import {FontGate} from './lib/FontGate';

export const Film: React.FC = () => {
  const frame = useCurrentFrame();
  const stage = frame < ACT.message.from ? 0 : frame < ACT.action.from ? 1 : 2;
  const acts = [ACT.title, ACT.message, ACT.action];
  const current = acts[stage];
  const copy = [spec.title, spec.message, spec.callToAction][stage];
  const arrival = enter(frame, current.from, FPS);
  const departure =
    stage < 2
      ? 1 - unit(frame, current.from + current.dur - FPS * 0.3, current.from + current.dur - 1)
      : 1;
  const u = Math.min(W / 1280, H / 720);
  const portrait = H > W;
  const pad = Math.min(W, H) * 0.1;
  const maxSize = (stage === 1 ? 64 : 92) * u;
  const size = Math.min(maxSize, Math.sqrt(((W - pad * 2) * (H * 0.38)) / (copy.length * 0.55)));
  const beat = (frame % BEAT) / BEAT;
  const tail = unit(frame, TOTAL - FPS * 0.6, TOTAL - 1);
  const logoDataUrl = 'logoDataUrl' in spec.brand ? String(spec.brand.logoDataUrl) : undefined;
  return (
    <FontGate>
      <AbsoluteFill
        style={{
          backgroundColor: C.background,
          color: C.foreground,
          fontFamily: FONT,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: pad,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18 * u,
              opacity: enter(frame, 0, FPS),
            }}
          >
            {logoDataUrl && (
              <Img
                src={logoDataUrl}
                style={{width: 64 * u, height: 64 * u, objectFit: 'contain'}}
              />
            )}
            <div style={{fontSize: 25 * u, fontWeight: 600, letterSpacing: '-0.02em'}}>
              {spec.brand.name}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 28 * u,
              transform: `translateY(${(1 - arrival) * 40 * u}px)`,
              opacity: arrival * departure,
            }}
          >
            <div style={{fontSize: 17 * u, letterSpacing: '0.16em', color: C.accent}}>
              {['THE IDEA', 'THE DIFFERENCE', 'YOUR NEXT STEP'][stage]}
            </div>
            <div
              key={stage}
              style={{
                fontSize: size,
                lineHeight: 1.1,
                fontWeight: 600,
                letterSpacing: '-0.045em',
                overflowWrap: 'anywhere',
                maxWidth: portrait ? '100%' : '92%',
              }}
            >
              {copy}
            </div>
            <div
              style={{
                height: 5 * u,
                width: 110 * u,
                backgroundColor: C.accent,
                transformOrigin: 'left',
                transform: `scaleX(${arrival})`,
              }}
            />
          </div>
          <div
            style={{display: 'flex', alignItems: 'flex-end', gap: 24 * u, opacity: 1 - tail * 0.4}}
          >
            <div style={{fontSize: 18 * u, fontVariantNumeric: 'tabular-nums', width: 35 * u}}>
              {String(stage + 1).padStart(2, '0')}
            </div>
            <div
              style={{
                flex: 1,
                height: 38 * u,
                position: 'relative',
                overflow: 'hidden',
                borderBottom: `${2 * u}px solid ${C.foreground}`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: C.accent,
                  transformOrigin: 'left',
                  transform: `scaleX(${unit(frame, 0, TOTAL - 1)})`,
                  opacity: 0.35,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  width: 56 * u,
                  height: 38 * u,
                  backgroundColor: C.accent,
                  transform: `translateX(${beat * (W - pad * 2 - 120 * u)}px)`,
                }}
              />
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </FontGate>
  );
};
