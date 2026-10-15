import {ACT, BEAT, FPS, TOTAL} from './timeline';
export default function cues() {
  const events: {f: number; kind: string; weight: number; id: string}[] = Object.entries(ACT).map(
    ([id, act]) => ({f: act.from, kind: 'snap', weight: 0.7, id}),
  );
  for (let frame = BEAT; frame < TOTAL - FPS; frame += BEAT) {
    if (!events.some((event) => event.f === frame))
      events.push({f: frame, kind: 'tick', weight: 0.7, id: `progress-${frame}`});
  }
  return events;
}
