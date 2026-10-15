import {parseArgs} from 'node:util';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {
  context,
  abs,
  repositoryRoot,
  tsxCli,
  exists,
  probe,
  int,
  writeJson,
} from './native-context.mjs';
import {scaffold} from './native-scaffold.mjs';
import {render, buildAudio} from './native-render.mjs';
import {deliver, brandKit} from './native-deliver.mjs';
import {layoutAudit} from './native-layout.mjs';
import {hfFinish, hfPreflight, hyperframes} from './native-hyperframes.mjs';
const strings =
  'project engine name width height size fps bpm browser entry sub frames crf concurrency samples samples-from budget measure spec audio audio-offset preset chunks out out-dir poster-frame poster-from comp gif-fps gif-width gif-max-mb gif-dither webm-crf alpha alpha-frames alpha-props variants variant-samples avatar font props crop safe json max-text-speed composition workers shutter variables export-cues blur';
const bools =
  'preview master 10bit no-audio build-audio no-check keep loop gif webm alpha-webm x-header cues copy speed no-speed skip-check allow-transparent help';
export function options(args, command) {
  const schema = Object.fromEntries([
    ...strings
      .split(' ')
      .filter((k) => k !== 'blur' || command === 'hf-finish')
      .map((k) => [k, {type: 'string'}]),
    ...bools.split(' ').map((k) => [k, {type: 'boolean'}]),
  ]);
  schema.floor = {type: 'string', multiple: true};
  schema.help = {type: 'boolean', short: 'h'};
  if (command === 'new') schema.font = {type: 'string', multiple: true};
  if (command !== 'hf-finish') schema.blur = {type: 'boolean'};
  return parseArgs({args, options: schema, allowPositionals: true, strict: true});
}
const pythonCommands = new Set([
  'accumulate',
  'measure-speed',
  'av-audit',
  'outline-text',
  'palette',
  'dither-gradient',
  'probe',
  'check-sync',
  'sheet',
  'forensics',
  'score',
  'synth',
  'master',
]);
export async function main(argv = process.argv.slice(2), defaultProject = process.cwd()) {
  const [command, ...raw] = argv;
  if (
    !command ||
    command === 'help' ||
    ((raw.includes('--help') || raw.includes('-h')) &&
      !pythonCommands.has(command) &&
      !['add-font', 'hyperframes', 'remotion'].includes(command))
  ) {
    console.log(
      'Native Cinetic v1.0.0: new, render, render-chunks, hf-finish, cues, audio, deliver, brand-kit, layout-audit, grab, add-font, lint, grid-check, remotion, hyperframes, review, ' +
        [...pythonCommands].join(', ') +
        '. Use --project PATH before passthrough arguments. See docs/windows-cinetic.md.',
    );
    return;
  }
  // Strip only the adapter-owned project option; passthrough tools keep their original arguments.
  const args = [...raw];
  let input = defaultProject;
  const pi = args.indexOf('--project');
  if (pi >= 0) {
    if (!args[pi + 1]) throw Error('--project needs a path');
    input = args[pi + 1];
    args.splice(pi, 2);
  }
  if (command === 'new') {
    const {values: o, positionals: p} = options(args, command);
    const size = (o.size || `${o.width || 1280}x${o.height || 720}`).split('x').map(Number);
    console.log(
      await scaffold({
        name: o.name || p[0],
        engine: o.engine,
        width: size[0],
        height: size[1],
        fps: Number(o.fps || 60),
        bpm: Number(o.bpm || 120),
        fonts: o.font || [],
        browser: o.browser,
      }),
    );
    return;
  }
  const c = await context(input);
  if (pythonCommands.has(command)) {
    console.log(
      await c.py(
        `${['score', 'synth', 'master'].includes(command) ? 'audio/' : ''}${command}.py`,
        args,
      ),
    );
    return;
  }
  if (command === 'hyperframes') {
    const [sub, ...rest] = args;
    console.log(
      await hyperframes(c, [
        sub,
        c.project,
        ...rest,
        ...(sub === 'snapshot' && !rest.includes('--describe') ? ['--describe', 'false'] : []),
      ]),
    );
    return;
  }
  if (command === 'remotion') {
    console.log(await c.cli(args));
    return;
  }
  if (command === 'add-font') {
    const npm =
      process.env.npm_execpath ||
      path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
    if (!exists(npm))
      throw Error('Set npm_execpath to npm-cli.js or run through npm.cmd run cinetic');
    console.log(
      await c.node(abs(c.project, 'scripts/add-font.mjs'), args, {
        env: {...c.env, CINETIC_NPM_CLI: npm},
      }),
    );
    return;
  }
  if (command === 'lint') {
    console.log(
      await c.node(abs(c.project, 'scripts/lint-film.mjs'), args.length ? args : ['src']),
    );
    return;
  }
  if (command === 'grid-check') {
    console.log(
      await c.node(tsxCli, [
        'scripts/grid-check.ts',
        ...(args.length ? args : ['src/timeline.ts']),
      ]),
    );
    return;
  }
  const {values: o, positionals: p} = options(args, command);
  if (command === 'cues' || command === 'audio') {
    const spec = JSON.parse(await readFile(abs(c.project, 'film.json'), 'utf8'));
    if (spec.engine === 'hyperframes') {
      const m = await hfPreflight(c, o);
      await writeJson(abs(c.project, o['export-cues'] || 'out/cues.json'), m.cues);
      if (command === 'audio')
        console.log(
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
          ]),
        );
    } else if (command === 'audio') await buildAudio(c);
    else console.log(await c.node(tsxCli, ['scripts/export-cues.ts']));
  } else if (command === 'render' || command === 'render-chunks') {
    if (!p[0] || !p[1]) throw Error('render needs COMPOSITION OUTPUT');
    console.log(
      await render(c, p[0], p[1], {
        ...o,
        extra: p.slice(2),
        ...(command === 'render-chunks' ? {chunks: o.chunks || 2} : {}),
      }),
    );
  } else if (command === 'hf-finish') {
    if (o['export-cues'])
      await writeJson(abs(c.project, o['export-cues']), (await hfPreflight(c, o)).cues);
    else {
      if (!p[0]) throw Error('hf-finish needs OUTPUT');
      console.log(await hfFinish(c, p[0], o));
    }
  } else if (command === 'deliver') console.log(await deliver(c, p[0], o));
  else if (command === 'brand-kit') console.log(await brandKit(c, o));
  else if (command === 'layout-audit') console.log(await layoutAudit(c, p[0] || 'Film', o));
  else if (command === 'grab') {
    const file = abs(c.project, p[0]),
      m = await probe(c, file),
      out = abs(c.project, o.out || 'out/qa/frames');
    await mkdir(out, {recursive: true});
    const frames = (o.frames || p[1] || '0').split(',').flatMap((s) => {
      if (s.includes('-')) {
        const [a, b] = s.split('-').map((v) => int(v, 0, m.frames - 1, 'grab frame'));
        if (b < a) throw Error('Reversed range');
        return Array.from({length: b - a + 1}, (_, i) => a + i);
      }
      return [int(s, 0, m.frames - 1, 'grab frame')];
    });
    for (const f of frames)
      await c.execute('ffmpeg', [
        '-v',
        'error',
        '-y',
        '-i',
        file,
        '-vf',
        `select=eq(n\\,${f})${o.crop ? `,crop=${o.crop}` : ''}${o.width ? `,scale=${int(o.width, 1, 8192, 'width')}:-1:flags=lanczos` : ''}`,
        '-frames:v',
        '1',
        '-fps_mode',
        'passthrough',
        path.join(out, `f${String(f).padStart(5, '0')}.png`),
      ]);
    console.log(out);
  } else if (command === 'review') {
    if (!p[0]) throw Error('review needs a review JSON file');
    const review = JSON.parse(await readFile(abs(c.project, p[0]), 'utf8'));
    const {validateReview} = await import('./native-review.mjs');
    const result = await validateReview(c.project, review);
    await writeJson(abs(c.project, o.json || 'out/qa/review.json'), result);
    if (!result.pass) throw Error(result.errors.join('\n'));
    console.log('Recorded creative review passes; human signoff remains explicit.');
  } else throw Error(`Unknown command ${command}`);
}
