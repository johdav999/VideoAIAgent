import {readFile, writeFile, mkdir, readdir, copyFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {abs, repositoryRoot, workdir, writeJson, int, exists} from './native-context.mjs';
import {hfTimeline} from './native-scaffold.mjs';
import {finish} from './native-render.mjs';
export const hfCli = path.join(repositoryRoot, 'node_modules/hyperframes/bin/hyperframes.mjs');
export async function hfPreflight(c, o = {}) {
  const entry = o.composition || 'index.html',
    html = await readFile(abs(c.project, entry), 'utf8');
  const root = html.match(/<[^>]+data-composition-id[^>]*>/)?.[0];
  if (!root) throw Error('Missing composition root');
  const attr = (k) => root.match(new RegExp(`data-${k}=["']([^"']+)["']`))?.[1];
  const {bf, film} = await hfTimeline(c.project),
    duration = Number(attr('duration')),
    fps = Number(attr('fps') || bf.FPS),
    width = Number(attr('width') || bf.W),
    height = Number(attr('height') || bf.H);
  if (
    ![duration, fps, width, height].every((v) => Number.isFinite(v) && v > 0) ||
    Math.abs(duration - film.TOTAL / bf.FPS) > 1e-6 ||
    fps !== bf.FPS
  )
    throw Error('HyperFrames root duration/fps differs from timeline');
  const files = [abs(c.project, entry)];
  async function walk(dir) {
    if (!exists(dir)) return;
    for (const e of await readdir(dir, {withFileTypes: true})) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) await walk(f);
      else if (f.endsWith('.html')) files.push(f);
    }
  }
  await walk(abs(c.project, 'compositions'));
  for (const f of files) {
    const s = await readFile(f, 'utf8');
    const urls = [
      ...s.matchAll(/<script[^>]*\bsrc=["']([^"']+)["']/gi),
      ...[...s.matchAll(/@font-face\s*\{[^}]*\}/gi)].flatMap((m) => [
        ...m[0].matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi),
      ]),
    ].map((m) => m[1]);
    for (const u of urls)
      if (!/^(https?:|data:|\/\/)/.test(u) && !exists(abs(c.project, u.replace(/^\//, ''))))
        throw Error(`Missing local script/font ${u}`);
  }
  return {
    duration,
    fps,
    width,
    height,
    total: film.TOTAL,
    cues: JSON.parse(JSON.stringify(film.cues())),
  };
}
export async function hyperframes(c, args) {
  const preload = pathToFileURL(
    path.join(repositoryRoot, 'src/cinetic-adapter/hyperframes-profile.mjs'),
  ).href;
  return c.node(hfCli, args, {
    env: {
      ...c.env,
      HYPERFRAMES_NO_TELEMETRY: '1',
      CINETIC_RUNTIME_HOME: abs(c.project, 'out/hyperframes-home'),
      NODE_OPTIONS: `${c.env.NODE_OPTIONS || ''} --import=${preload}`.trim(),
    },
  });
}
export async function hfFinish(c, outName, o = {}) {
  const report = {engine: 'hyperframes', steps: [], pass: false, shipReady: false};
  const out = abs(c.project, outName),
    qa = path.join(path.dirname(out), 'qa');
  await mkdir(qa, {recursive: true});
  const reportFile = abs(
    c.project,
    o.json || path.join(qa, `${path.basename(out, '.mp4')}-hf.json`),
  );
  try {
    const m = await hfPreflight(c, o);
    report.steps.push('preflight');
    const fps = int(o.fps ?? m.fps, 1, 120, 'fps'),
      k = o.preview ? 1 : int(o.blur ?? 1, 1, 16, 'blur');
    if (fps * k > 240) throw Error('HyperFrames caps at 240 capture fps');
    const work = await workdir(c.project, 'hyperframes'),
      frames = path.join(work, 'frames');
    const lint = await hyperframes(c, ['lint', c.project, '--json']);
    await writeFile(path.join(qa, 'hf-lint.json'), lint);
    const l = JSON.parse(lint.slice(lint.indexOf('{'), lint.lastIndexOf('}') + 1));
    if (l.errorCount !== 0) throw Error(`HyperFrames lint reported ${l.errorCount} errors`);
    report.steps.push('lint');
    if (!o.preview && !o['skip-check']) {
      await writeFile(
        path.join(qa, 'hf-check.log'),
        await hyperframes(c, ['check', c.project, ...(o.composition ? ['-c', o.composition] : [])]),
      );
      report.steps.push('check');
    }
    await hyperframes(c, [
      'render',
      c.project,
      '--format',
      'png-sequence',
      '--fps',
      fps * k,
      '-o',
      frames,
      '--workers',
      int(o.workers ?? 2, 1, 4, 'workers'),
      '--strict',
      '--quiet',
      ...(o.composition ? ['-c', o.composition] : []),
      ...(o.variables ? ['--variables', o.variables, '--strict-variables'] : []),
    ]);
    const pngs = (await readdir(frames)).filter((f) => /^frame_\d+\.png$/.test(f)).sort();
    const expected = Math.round(m.duration * fps * k);
    if (pngs.length !== expected) throw Error(`Captured ${pngs.length} PNGs, expected ${expected}`);
    const sharp = (await import('sharp')).default;
    if (!o['allow-transparent'])
      for (const f of [pngs[0], pngs.at(-1)]) {
        const {data, info} = await sharp(path.join(frames, f))
          .ensureAlpha()
          .raw()
          .toBuffer({resolveWithObject: true});
        for (let i = 3; i < data.length; i += info.channels)
          if (data[i] < 255)
            throw Error('HyperFrames capture is transparent: add a full bleed background clip');
      }
    await copyFile(
      path.join(frames, pngs.at(-1)),
      path.join(qa, `${path.basename(out, '.mp4')}-last-frame.png`),
    );
    report.steps.push('capture');
    const picture = path.join(work, 'picture.mp4');
    if (k > 1)
      await c.py('accumulate.py', [
        path.join(frames, 'frame_*.png'),
        picture,
        '--uniform',
        k,
        '--in-fps',
        fps * k,
        '--shutter',
        o.shutter ?? 240,
        '--crf',
        o.crf ?? 14,
      ]);
    else
      await c.execute('ffmpeg', [
        '-v',
        'error',
        '-y',
        '-framerate',
        fps,
        '-start_number',
        '1',
        '-i',
        path.join(frames, 'frame_%06d.png'),
        '-vf',
        'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p',
        '-c:v',
        'libx264',
        '-crf',
        o.crf ?? (o.preview ? 20 : 14),
        '-preset',
        o.preview ? 'veryfast' : 'slow',
        '-colorspace',
        'bt709',
        '-color_primaries',
        'bt709',
        '-color_trc',
        'bt709',
        '-color_range',
        'tv',
        picture,
      ]);
    let audio = o.audio;
    if (!audio && exists(path.join(frames, 'audio.m4a'))) {
      audio = path.join(frames, 'audio.m4a');
      report.unmasteredAudio = true;
    }
    await finish(
      c,
      picture,
      out,
      {...m, fps},
      [0, Math.round(m.duration * fps) - 1],
      {...o, audio, 'no-audio': !audio, 'no-check': true},
      qa,
    );
    if (!o['skip-check']) {
      if (o.audio)
        await c.py('check-sync.py', [
          out,
          abs(c.project, o.audio),
          '--json',
          path.join(qa, 'sync.json'),
        ]);
      await c.py('probe.py', [
        out,
        '--spec',
        `${m.width}x${m.height}@${fps}`,
        '--frames',
        Math.round(m.duration * fps),
        '--audio',
        audio ? 'required' : 'none',
        ...(o.audio ? [] : ['--no-loudness']),
        '--json',
        path.join(qa, 'probe.json'),
      ]);
      report.steps.push('probe');
    }
    report.pass = true;
    return out;
  } catch (e) {
    report.error = e.message;
    throw e;
  } finally {
    await mkdir(path.dirname(reportFile), {recursive: true});
    await writeJson(reportFile, report);
  }
}
