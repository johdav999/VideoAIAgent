import {mkdir, copyFile, stat, readFile} from 'node:fs/promises';
import path from 'node:path';
import {
  abs,
  helpers,
  writeJson,
  probe,
  movieBundle,
  metadata,
  still,
  exists,
  int,
  tsxCli,
  frameRange,
} from './native-context.mjs';
import {render} from './native-render.mjs';
export async function deliver(c, masterName, o) {
  const master = abs(c.project, masterName),
    m = await probe(c, master),
    dir = abs(c.project, o['out-dir'] || 'out/deliver'),
    qa = path.join(dir, 'qa');
  await mkdir(qa, {recursive: true});
  const name = path.basename(master, path.extname(master)),
    checks = [],
    files = [];
  let site;
  const pf = int(o['poster-frame'] ?? m.frames - 1, 0, m.frames - 1, 'poster frame');
  const decoded = path.join(qa, 'poster-master.png'),
    clean = path.join(qa, 'poster-clean.png');
  await c.execute('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-i',
    master,
    '-vf',
    `select=eq(n\\,${pf}),scale=in_color_matrix=auto:in_range=auto:flags=accurate_rnd+full_chroma_int,format=rgb24`,
    '-frames:v',
    '1',
    '-fps_mode',
    'passthrough',
    decoded,
  ]);
  let source = 'master',
    why = 'No matching clean source';
  try {
    if (o['poster-from']) await copyFile(abs(c.project, o['poster-from']), clean);
    else if (exists(abs(c.project, o.entry || c.entry || 'src/index.ts'))) {
      site = await movieBundle(c, o.entry);
      const meta = await metadata(c, site, o.comp || 'Film');
      if (meta.durationInFrames !== m.frames || meta.width !== m.width || meta.height !== m.height)
        throw Error('Composition metadata differs from master');
      await still(c, site, o.comp || 'Film', clean, {}, pf);
    } else {
      if (pf !== m.frames - 1) throw Error('HyperFrames retained still is the last frame');
      await copyFile(path.join(path.dirname(master), 'qa', `${name}-last-frame.png`), clean);
    }
    await c.py(path.join(helpers, 'poster-match.py'), [clean, decoded]);
    source = 'clean';
    why = null;
  } catch (e) {
    why = e.message;
  }
  await copyFile(source === 'clean' ? clean : decoded, path.join(dir, 'poster.png'));
  await c.execute('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-i',
    path.join(dir, 'poster.png'),
    '-q:v',
    '2',
    path.join(dir, 'poster.jpg'),
  ]);
  files.push('poster.png', 'poster.jpg');
  checks.push({check: 'poster_source', pass: true, source, frame: pf, warning: why});
  let failed = false;
  if (o.loop) {
    const f = `${name}-loop.mp4`;
    await c.execute('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-i',
      master,
      '-map',
      '0:v:0',
      '-c',
      'copy',
      '-an',
      '-movflags',
      '+faststart',
      path.join(dir, f),
    ]);
    files.push(f);
    try {
      await c.py(path.join(helpers, 'loop-seam.py'), [master, path.join(qa, 'loop-seam.json')]);
      checks.push({check: 'loop_seam', pass: true});
    } catch (e) {
      checks.push({check: 'loop_seam', pass: false, error: e.message});
      failed = true;
    }
  }
  if (o.gif) {
    const fps = int(o['gif-fps'] ?? 25, 1, 50, 'gif fps'),
      width = int(o['gif-width'] ?? 960, 16, 3840, 'gif width');
    const filter = `scale=${width}:-2:flags=lanczos:in_color_matrix=auto:in_range=auto,format=rgb24,fps=${fps}`;
    const palette = path.join(qa, 'palette.png'),
      f = `${name}.gif`;
    await c.execute('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-i',
      master,
      '-vf',
      `${filter},palettegen=max_colors=256:stats_mode=full`,
      palette,
    ]);
    await c.execute('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-i',
      master,
      '-i',
      palette,
      '-lavfi',
      `${filter}[x];[x][1:v]paletteuse=dither=${o['gif-dither'] || 'sierra2_4a'}:diff_mode=rectangle`,
      '-loop',
      '0',
      path.join(dir, f),
    ]);
    const mb = (await stat(path.join(dir, f))).size / 1e6;
    checks.push({check: 'gif_size', pass: mb <= Number(o['gif-max-mb'] ?? 8), mb});
    files.push(f);
  }
  if (o.webm) {
    const f = `${name}.webm`;
    await c.execute('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-i',
      master,
      '-map',
      '0:v:0',
      ...(m.audio && !o.loop ? ['-map', '0:a:0', '-c:a', 'libopus', '-b:a', '160k'] : ['-an']),
      '-c:v',
      'libvpx-vp9',
      '-crf',
      o['webm-crf'] ?? 32,
      '-b:v',
      '0',
      '-row-mt',
      '1',
      '-cpu-used',
      '2',
      '-pix_fmt',
      'yuv420p',
      '-colorspace',
      'bt709',
      '-color_primaries',
      'bt709',
      '-color_trc',
      'bt709',
      '-color_range',
      'tv',
      path.join(dir, f),
    ]);
    files.push(f);
  }
  if (o.alpha) {
    site ||= await movieBundle(c, o.entry);
    for (const id of o.alpha.split(',')) {
      if (!/^[\w-]+$/.test(id)) throw Error('Invalid composition ID');
      const common = [
        '--muted',
        '--log=error',
        '--image-format=png',
        '--color-space=bt709',
        `--props=${o['alpha-props'] || '{}'}`,
        ...(o['alpha-frames'] ? [`--frames=${o['alpha-frames']}`] : []),
      ];
      const mov = path.join(dir, `${id}.mov`);
      await c.cli([
        'render',
        site,
        id,
        mov,
        '--codec=prores',
        '--prores-profile=4444',
        '--pixel-format=yuva444p10le',
        ...common,
      ]);
      await c.py(path.join(helpers, 'alpha-check.py'), [mov]);
      files.push(`${id}.mov`);
      if (o['alpha-webm']) {
        await c.cli([
          'render',
          site,
          id,
          path.join(dir, `${id}-alpha.webm`),
          '--codec=vp9',
          '--pixel-format=yuva420p',
          ...common,
        ]);
        files.push(`${id}-alpha.webm`);
      }
    }
  }
  for (const id of (o.variants || '').split(',').filter(Boolean)) {
    if (!/^[\w-]+$/.test(id)) throw Error('Invalid variant ID');
    await render(c, id, path.join(dir, `${id}.mp4`), {
      entry: o.entry,
      audio: o.audio,
      'no-audio': o['no-audio'],
      ...(o['variant-samples'] ? {blur: true, 'samples-from': o['variant-samples']} : {}),
    });
    files.push(`${id}.mp4`);
  }
  const manifest = {
    pass: !failed && checks.every((c) => c.pass),
    checks,
    files: await Promise.all(
      files.map(async (f) => ({
        file: f,
        bytes: (await stat(path.join(dir, f))).size,
        probe: (await probe(c, path.join(dir, f))).raw,
      })),
    ),
    shipReady: false,
  };
  await writeJson(path.join(qa, 'manifest.json'), manifest);
  if (failed) throw Error('Delivery gates failed; see manifest');
  return dir;
}
export async function brandKit(c, o) {
  const dir = abs(c.project, o.out || 'out/deliver/brand');
  await mkdir(dir, {recursive: true});
  await c.node(tsxCli, [
    'scripts/brand-svg.ts',
    '--out',
    dir,
    ...(o.name ? ['--name', o.name] : []),
    ...(o.font ? ['--font', abs(c.project, o.font)] : []),
  ]);
  const site = await movieBundle(c, o.entry);
  const work = path.join(dir, 'qa');
  await mkdir(work, {recursive: true});
  for (const s of [16, 32, 512, 1024])
    await still(c, site, 'BrandMark', path.join(dir, `mark-${s}.png`), {size: s, ground: 'light'});
  for (const s of [512, 1024])
    await still(c, site, 'BrandMark', path.join(dir, `mark-${s}-dark.png`), {
      size: s,
      ground: 'dark',
    });
  for (const ground of ['light', 'dark'])
    await still(c, site, 'BrandLockup', path.join(work, `lockup-${ground}.png`), {ground});
  await still(c, site, 'BrandAvatar', path.join(dir, 'avatar.png'), {ground: o.avatar || 'light'});
  if (o['x-header'])
    await still(c, site, 'BrandHeader', path.join(dir, 'x-header.png'), {
      ground: o.avatar || 'light',
    });
  await c.py(path.join(helpers, 'crop-lockups.py'), [work, dir]);
  return dir;
}
