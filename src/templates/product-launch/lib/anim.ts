import {interpolate} from 'remotion';
export const unit = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
export const enter = (frame: number, from: number, fps: number) => {
  const t = unit(frame, from, from + fps * 0.4);
  return 1 - (1 - t) ** 3;
};
