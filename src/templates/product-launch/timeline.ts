import spec from './spec.json';
export const FPS = spec.fps;
export const BPM = 120;
export const W = spec.width;
export const H = spec.height;
export const TOTAL = spec.durationSeconds * FPS;
export const BEAT = FPS / 2;
export const BAR = BEAT * 4;
export const TAIL = FPS;
const titleEnd = Math.round((TOTAL * 0.3) / BEAT) * BEAT;
const messageEnd = Math.round((TOTAL * 0.65) / BEAT) * BEAT;
export const ACT = {
  title: {from: 0, dur: titleEnd},
  message: {from: titleEnd, dur: messageEnd - titleEnd},
  action: {from: messageEnd, dur: TOTAL - messageEnd},
};
export const CUE = {
  title: 0,
  message: titleEnd,
  action: messageEnd,
  beats: Array.from({length: Math.floor((TOTAL - TAIL) / BEAT)}, (_, i) => i * BEAT),
};
export const COPY = [
  {id: 'brand', text: spec.brand.name, in: 0, resolved: Math.round(FPS * 0.4), out: TOTAL},
  {
    id: 'title',
    text: spec.title,
    in: 0,
    resolved: Math.round(FPS * 0.4),
    out: titleEnd - Math.round(FPS * 0.3),
  },
  {
    id: 'message',
    text: spec.message,
    in: titleEnd,
    resolved: titleEnd + Math.round(FPS * 0.4),
    out: messageEnd - Math.round(FPS * 0.3),
  },
  {
    id: 'action',
    text: spec.callToAction,
    in: messageEnd,
    resolved: messageEnd + Math.round(FPS * 0.4),
    out: TOTAL,
  },
  {
    id: 'title-label',
    text: 'THE IDEA',
    in: 0,
    resolved: Math.round(FPS * 0.4),
    out: titleEnd - Math.round(FPS * 0.3),
  },
  {
    id: 'message-label',
    text: 'THE DIFFERENCE',
    in: titleEnd,
    resolved: titleEnd + Math.round(FPS * 0.4),
    out: messageEnd - Math.round(FPS * 0.3),
  },
  {
    id: 'action-label',
    text: 'YOUR NEXT STEP',
    in: messageEnd,
    resolved: messageEnd + Math.round(FPS * 0.4),
    out: TOTAL,
  },
];
