import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {abs, workdir, movieBundle, metadata, helpers, tsxCli, int} from './native-context.mjs';
export async function layoutAudit(c, comp, o) {
  const site = await movieBundle(c, o.entry),
    meta = await metadata(c, site, comp);
  const work = await workdir(c.project, 'layout');
  const importer = path.join(work, 'timeline.mts');
  await writeFile(
    importer,
    `import * as T from ${JSON.stringify(pathToFileURL(abs(c.project, path.join(path.dirname(o.entry || 'src/index.ts'), 'timeline.ts'))).href)}; console.log(JSON.stringify(T));`,
  );
  const output = await c.node(tsxCli, [importer]),
    t = JSON.parse(output.trim());
  const act = /^Act(\d+)$/.exec(comp),
    a = act ? Object.values(t.ACT)[Number(act[1]) - 1] : null;
  const lo = a?.from || 0,
    hi = a ? lo + a.dur : t.TOTAL;
  let want;
  if (o.frames)
    want = o.frames.split(',').map((f) => int(f, 0, meta.durationInFrames - 1, 'audit frame'));
  else {
    const list = [];
    for (const copy of t.COPY || []) {
      const end = Math.min(copy.out ?? t.TOTAL, t.TOTAL) - 1;
      list.push(copy.resolved);
      if (!o.cues) list.push(Math.floor((copy.resolved + end) / 2), end);
    }
    if (o.cues) list.push(...Object.values(t.CUE).flat());
    want = list.filter((f) => f >= lo && f < hi).map((f) => Math.round(f - lo));
  }
  want = [...new Set(want)].sort((a, b) => a - b);
  if (!want.length) throw Error('No audit frames');
  const speed = !o['no-speed'] && (o.speed || o.cues || o['max-text-speed']);
  const frames = [
    ...new Set(want.flatMap((f) => (speed && f + 1 < meta.durationInFrames ? [f, f + 1] : [f]))),
  ].sort((a, b) => a - b);
  const props = {...JSON.parse(o.props || '{}'), audit: true};
  if (o.safe) {
    if (/^\s*\{/.test(o.safe)) props.safe = JSON.parse(o.safe);
    else if (/^[a-z]/i.test(o.safe)) props.safe = o.safe;
    else {
      const n = o.safe.split(',').map(Number);
      if (n.some((v) => !Number.isFinite(v) || v < 0) || ![2, 4].includes(n.length))
        throw Error('Invalid safe insets');
      props.safe =
        n.length === 2 ? {x: n[0], y: n[1]} : {top: n[0], right: n[1], bottom: n[2], left: n[3]};
    }
  }
  const out = abs(c.project, o.out || `out/qa/layout-${comp}-${Date.now()}`);
  await mkdir(out, {recursive: true});
  let log = '';
  const {renderStill} = await import('@remotion/renderer');
  for (const frame of frames)
    await renderStill({
      serveUrl: site,
      composition: {...meta, props},
      inputProps: props,
      frame,
      output: path.join(out, `f${String(frame).padStart(5, '0')}.png`),
      imageFormat: 'png',
      browserExecutable: c.browser,
      chromiumOptions: {gl: 'angle'},
      onBrowserLog: (entry) => {
        log += entry.text + '\n';
      },
    });
  const logFile = path.join(work, 'audit.log');
  await writeFile(logFile, log);
  const report = abs(c.project, o.json || `out/qa/layout-${comp}.json`);
  await mkdir(path.dirname(report), {recursive: true});
  await c.node(path.join(helpers, 'layout-report.cjs'), [
    logFile,
    report,
    comp,
    want.join(','),
    out,
    speed ? Number(o['max-text-speed'] ?? 20) : 0,
    meta.durationInFrames,
  ]);
  return report;
}
