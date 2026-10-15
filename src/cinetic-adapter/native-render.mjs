import {mkdir, copyFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {
  abs,
  json,
  writeJson,
  exists,
  workdir,
  movieBundle,
  metadata,
  frameRange,
  int,
  probe,
} from './native-context.mjs';

export async function buildAudio(c) {
  const {tsxCli} = await import('./native-context.mjs');
  await c.node(tsxCli, ['scripts/grid-check.ts', 'src/timeline.ts']);
  await c.node(tsxCli, ['scripts/export-cues.ts']);
  await c.py('audio/score.py', [
    '--cues',
    'out/cues.json',
    '--score',
    'audio/score.json',
    '--out',
    'public/audio/soundtrack.wav',
    '--stems',
    'out/stems',
    '--json',
    'out/qa/score.json',
  ]);
}
export async function finish(c, picture, out, meta, range, o, qa) {
  const n = range[1] - range[0] + 1;
  const audio = abs(c.project, o.audio || 'public/audio/soundtrack.wav');
  const silent = !!o['no-audio'];
  if (!silent && !exists(audio))
    throw Error(`Soundtrack missing: ${audio}; use --build-audio or --no-audio`);
  await mkdir(path.dirname(out), {recursive: true});
  await mkdir(qa, {recursive: true});
  const offset = int(o['audio-offset'] ?? range[0], 0, 1000000, 'audio offset') / meta.fps;
  await c.execute('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-i',
    picture,
    ...(silent ? [] : ['-ss', offset, '-i', audio]),
    '-map',
    '0:v:0',
    ...(silent
      ? ['-an']
      : [
          '-map',
          '1:a:0',
          '-af',
          'apad',
          '-c:a',
          'aac',
          '-b:a',
          '320k',
          '-ar',
          '48000',
          '-ac',
          '2',
        ]),
    '-c:v',
    'copy',
    '-bsf:v',
    'h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0',
    '-color_primaries',
    'bt709',
    '-color_trc',
    'bt709',
    '-colorspace',
    'bt709',
    '-color_range',
    'tv',
    '-t',
    n / meta.fps,
    '-movflags',
    '+faststart',
    out,
  ]);
  if (!o['no-check']) {
    if (!silent)
      await c.py('check-sync.py', [
        out,
        audio,
        '--ref-offset',
        offset,
        '--json',
        path.join(qa, 'sync.json'),
      ]);
    await c.py('probe.py', [
      out,
      '--spec',
      o.spec || `${meta.width}x${meta.height}@${meta.fps}`,
      '--frames',
      n,
      '--audio',
      silent ? 'none' : 'required',
      '--no-loudness',
      '--pix-fmt',
      o['10bit'] ? 'yuv420p10le' : 'yuv420p',
      '--json',
      path.join(qa, 'probe.json'),
    ]);
  }
  const facts = await probe(c, out);
  if (facts.frames !== n) throw Error(`Encoded ${facts.frames} frames; expected ${n}`);
  await writeJson(path.join(qa, 'render.json'), {
    output: out,
    frames: n,
    range,
    mode: o.blur ? 'blur' : o.preview ? 'preview' : 'master',
    checked: !o['no-check'],
    shipReady: false,
    ffprobe: facts.raw,
  });
  return out;
}
export async function render(c, comp, outName, o = {}) {
  if (o['10bit'] && !o.blur) throw Error('--10bit requires --blur');
  const conc = int(o.concurrency ?? 2, 1, 4, 'concurrency');
  if (o['build-audio']) await buildAudio(c);
  const site = await movieBundle(c, o.entry);
  const inputProps = JSON.parse(o.props || '{}');
  const meta = await metadata(c, site, comp, inputProps);
  const range = frameRange(o.frames, meta.durationInFrames),
    n = range[1] - range[0] + 1;
  const work = await workdir(c.project, 'render');
  const picture = path.join(work, 'picture.mp4');
  const out = abs(c.project, outName),
    qa = path.join(path.dirname(out), 'qa', path.basename(out, path.extname(out)));
  const base = [
    'render',
    site,
    comp,
    picture,
    '--codec=h264',
    '--muted',
    '--image-format=jpeg',
    '--jpeg-quality=95',
    `--concurrency=${conc}`,
    `--props=${JSON.stringify(inputProps)}`,
    '--log=error',
    ...(o.extra || []),
  ];
  const sharp = (
    dest,
    r,
    crf = Number(o.crf ?? (o.preview ? 20 : 14)),
    preset = o.preview ? 'veryfast' : o.preset || 'slow',
  ) =>
    c.cli([
      ...base.slice(0, 3),
      dest,
      ...base.slice(4),
      `--frames=${r.join('-')}`,
      `--crf=${crf}`,
      `--x264-preset=${preset}`,
      '--pixel-format=yuv420p',
      '--color-space=bt709',
    ]);
  if (o.chunks) {
    const k = int(o.chunks, 1, 4, 'chunks');
    if (o.blur) throw Error('Use blur or chunk rendering, separately');
    const parts = Array.from({length: Math.min(k, n)}, (_, i) => [
      range[0] + Math.floor((i * n) / Math.min(k, n)),
      range[0] + Math.floor(((i + 1) * n) / Math.min(k, n)) - 1,
    ]);
    const results = await Promise.allSettled(
      parts.map((r, i) =>
        c.cli([
          ...base.slice(0, 3),
          path.join(work, `part-${i}.mp4`),
          ...base.slice(4).filter((a) => !a.startsWith('--concurrency')),
          '--concurrency=1',
          `--frames=${r.join('-')}`,
          `--crf=${o.crf ?? 14}`,
          `--x264-preset=${o.preset || 'slow'}`,
          '--pixel-format=yuv420p',
          '--color-space=bt709',
        ]),
      ),
    );
    for (const r of results) if (r.status === 'rejected') throw r.reason;
    await writeFile(
      path.join(work, 'concat.txt'),
      parts.map((_, i) => `file 'part-${i}.mp4'`).join('\n'),
    );
    await c.execute('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-f',
      'concat',
      '-safe',
      '1',
      '-i',
      path.join(work, 'concat.txt'),
      '-c',
      'copy',
      picture,
    ]);
    await writeJson(path.join(work, 'chunks.json'), {parts, independentProcesses: true});
  } else if (o.blur) {
    const samples = abs(c.project, o.samples || 'out/samples.json');
    await mkdir(path.dirname(samples), {recursive: true});
    const extraMeasure = o.measure ? JSON.parse(o.measure) : [];
    if (!Array.isArray(extraMeasure) || extraMeasure.some((x) => typeof x !== 'string'))
      throw Error('--measure must be a JSON array of argument strings');
    const measure = [
      ...(o.budget ? ['--budget', o.budget] : []),
      ...(o.floor || []).flatMap((f) => ['--floor', f]),
      ...extraMeasure,
    ];
    if (o['samples-from']) {
      if (measure.length)
        await c.py('measure-speed.py', [abs(c.project, o['samples-from']), samples, ...measure]);
      else if (abs(c.project, o['samples-from']) !== samples)
        await copyFile(abs(c.project, o['samples-from']), samples);
    } else {
      const t = Date.now();
      await sharp(path.join(work, 'sharp.mp4'), range, 12, 'veryfast');
      await c.py('measure-speed.py', [
        path.join(work, 'sharp.mp4'),
        samples,
        '--offset',
        range[0],
        ...(exists(abs(c.project, 'out/cues.json')) ? ['--cues', 'out/cues.json'] : []),
        ...measure,
      ]);
      const s = await json(samples);
      s.sharp_s_per_frame = (Date.now() - t) / 1000 / n;
      await writeJson(samples, s);
    }
    const s = await json(samples);
    if (
      !Array.isArray(s.groups) ||
      s.groups.length <= range[1] ||
      s.groups.some((g) => !Number.isInteger(g) || g < 1 || g > 256)
    )
      throw Error('Samples do not cover the requested range or contain invalid groups');
    const a = s.groups.slice(0, range[0]).reduce((a, b) => a + b, 0),
      b = a + s.groups.slice(range[0], range[1] + 1).reduce((a, b) => a + b, 0) - 1;
    if (b - a > 500000) throw Error('Subframe resource limit exceeded');
    await c.cli([
      'render',
      site,
      o.sub || `${comp}Sub`,
      path.join(work, 'sub.mp4'),
      `--props=${JSON.stringify({...inputProps, ...s})}`,
      `--frames=${a}-${b}`,
      '--codec=h264',
      '--crf=6',
      '--x264-preset=veryfast',
      '--pixel-format=yuv444p',
      '--color-space=default',
      '--muted',
      '--image-format=jpeg',
      '--jpeg-quality=95',
      `--concurrency=${conc}`,
      '--log=error',
      ...(o.extra || []),
    ]);
    await c.py('accumulate.py', [
      path.join(work, 'sub.mp4'),
      samples,
      picture,
      '--start',
      range[0],
      '--count',
      n,
      '--crf',
      o.crf ?? 14,
      ...(o['10bit'] ? ['--10bit'] : []),
    ]);
  } else await sharp(picture, range);
  return finish(c, picture, out, meta, range, o, qa);
}
