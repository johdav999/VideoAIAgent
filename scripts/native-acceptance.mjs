// Real Windows acceptance: no mock renderer. Artifacts are deliberately ignored by Git.
import {mkdir, readFile, writeFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {scaffold} from '../src/cinetic-adapter/native-scaffold.mjs';
import {
  context,
  abs,
  repositoryRoot,
  writeJson,
  json,
  copyScripts,
  python,
  probe,
} from '../src/cinetic-adapter/native-context.mjs';
import {run} from '../src/renderer/process.mjs';
const resume = process.argv[2];
const prior = resume ? await json(path.resolve(resume, 'results.json')) : null;
const id = Date.now();
const root = resume
  ? path.resolve(resume)
  : path.join(repositoryRoot, `data/native-acceptance-${id}`);
await mkdir(root, {recursive: true});
const project =
  prior?.project ||
  (await scaffold({name: `Acceptance ö ${id}`, width: 640, height: 360, fps: 30, bpm: 120}));
const hf =
  prior?.hf ||
  (await scaffold({
    name: `Acceptance HF ö ${id}`,
    engine: 'hyperframes',
    width: 640,
    height: 360,
    fps: 30,
    bpm: 120,
  }));
await copyScripts(project);
await copyScripts(hf);
await writeFile(
  abs(project, 'src/acceptance.tsx'),
  `import React from 'react';
import {registerRoot,Composition,useCurrentFrame} from 'remotion';
import {RemotionRoot} from './Root';
const Clip=({alpha=false}:{alpha?:boolean})=>{const f=useCurrentFrame();return <div style={{position:'absolute',inset:0,background:alpha?'transparent':'#f6f7f9'}}><div style={{position:'absolute',left:130+30*Math.sin(f*2*Math.PI/59),top:60,width:60,height:60,background:'#1f86cd',borderRadius:10}}/></div>};
registerRoot(()=> <><RemotionRoot/><Composition id="Loop" component={Clip} fps={30} durationInFrames={60} width={320} height={180}/><Composition id="Alpha" component={Clip} defaultProps={{alpha:true}} fps={30} durationInFrames={30} width={320} height={180}/><Composition id="Square" component={Clip} fps={30} durationInFrames={30} width={320} height={320}/><Composition id="Portrait" component={Clip} fps={30} durationInFrames={30} width={320} height={568}/></>);`,
);
await writeJson(abs(project, 'gradient.json'), {
  size: [320, 180],
  seed: 11,
  backdrops: [
    {
      name: 'ramp',
      type: 'linear',
      angle: 180,
      stops: [
        ['#0b0c0e', 0],
        ['#16181c', 1],
      ],
    },
  ],
});
const results = prior?.results.filter((r) => r.pass) || [];
async function step(name, args, {p = project, expectFailure = false, script} = {}) {
  if (results.some((r) => r.name === name && r.pass)) return;
  const started = Date.now();
  console.log(`[acceptance] ${name}`);
  let passed = false,
    log = '';
  try {
    log = await run(
      process.execPath,
      [
        path.join(repositoryRoot, script || 'scripts/cinetic.mjs'),
        ...(script ? args : [args[0], '--project', p, ...args.slice(1)]),
      ],
      {cwd: repositoryRoot, timeoutMs: 1800000},
    );
    passed = !expectFailure;
  } catch (e) {
    log = e.stack;
    passed = expectFailure;
  }
  await writeFile(path.join(root, `${name}.log`), log);
  results.push({
    name,
    pass: passed,
    expectedFailure: expectFailure,
    seconds: (Date.now() - started) / 1000,
  });
  await writeJson(path.join(root, 'results.json'), {
    platform: process.platform,
    node: process.version,
    project,
    hf,
    results,
    pass: results.every((r) => r.pass),
    complete: false,
  });
  if (!passed) throw Error(`${name} failed: ${log.slice(-2500)}`);
}
try {
  await step('audio', ['audio']);
  await step('preview', ['render', 'Film', 'out/preview.mp4', '--preview']);
  await step('chunks', [
    'render-chunks',
    'Film',
    'out/chunks.mp4',
    '--frames',
    '15-44',
    '--chunks',
    '2',
  ]);
  await step('blur10', [
    'render',
    'Film',
    'out/blur10.mp4',
    '--blur',
    '--10bit',
    '--frames',
    '20-39',
    '--no-audio',
    '--budget',
    '4',
    '--floor',
    '20-25:4',
  ]);
  await step('blur-reuse', [
    'render',
    'Film',
    'out/blur8.mp4',
    '--blur',
    '--frames',
    '20-39',
    '--no-audio',
    '--samples-from',
    'out/samples.json',
    '--budget',
    '4',
  ]);
  await step('full-blur-master', [
    'render',
    'Film',
    'out/full-master.mp4',
    '--blur',
    '--budget',
    '6',
  ]);
  await step('loop-render', [
    'render',
    'Loop',
    'out/loop.mp4',
    '--entry',
    'src/acceptance.tsx',
    '--no-audio',
  ]);
  await step('delivery', [
    'deliver',
    'out/loop.mp4',
    '--entry',
    'src/acceptance.tsx',
    '--comp',
    'Loop',
    '--loop',
    '--gif',
    '--gif-width',
    '320',
    '--webm',
    '--alpha',
    'Alpha',
    '--alpha-webm',
    '--alpha-frames',
    '0-7',
    '--variants',
    'Square,Portrait',
    '--no-audio',
  ]);
  await step('poster-fallback', [
    'deliver',
    'out/preview.mp4',
    '--entry',
    'missing.ts',
    '--out-dir',
    'out/fallback',
  ]);
  await step(
    'loop-negative',
    ['deliver', 'out/preview.mp4', '--loop', '--out-dir', 'out/rejected-loop'],
    {expectFailure: true},
  );
  await step('brand', ['brand-kit', '--x-header']);
  await step('font-local', ['add-font', 'geist', '--role', 'text']);
  await step('outline', [
    'outline-text',
    '--font',
    path.join(
      repositoryRoot,
      'node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2',
    ),
    '--text',
    'Å Video ö',
    '--size',
    '100',
    '--weight',
    '600',
  ]);
  await step('palette', ['palette', '--accent', '#1F86CD', '--json', 'out/qa/palette.json']);
  await step('palette-negative', ['palette', '--accent', '#F26B1D'], {expectFailure: true});
  await step('gradient', [
    'dither-gradient',
    '--spec',
    'gradient.json',
    '--out',
    'public/fx',
    '--preview',
    'out/qa/bands',
  ]);
  await step('layout', [
    'layout-audit',
    'Film',
    '--frames',
    '180',
    '--speed',
    '--safe',
    'wide16x9',
  ]);
  await step(
    'layout-negative',
    ['layout-audit', 'Film', '--frames', '180', '--safe', '200,200,200,200'],
    {expectFailure: true},
  );
  await step('grab', [
    'grab',
    'out/preview.mp4',
    '--frames',
    '0,20-22',
    '--crop',
    '320:180:0:0',
    '--width',
    '160',
  ]);
  await step('grab-negative', ['grab', 'out/preview.mp4', '--frames', '999999'], {
    expectFailure: true,
  });
  await step('sheet-video', [
    'sheet',
    'out/preview.mp4',
    '--every',
    '30',
    '--out',
    'out/qa/sheet.png',
  ]);
  await step('sheet-composition', [
    'sheet',
    '--comp',
    'Act1',
    '--from',
    '0',
    '--to',
    '60',
    '--every',
    '30',
    '--out',
    'out/qa/comp-sheet.png',
  ]);
  await step('forensics', [
    'forensics',
    'out/preview.mp4',
    '--cues',
    'out/cues.json',
    '--json',
    'out/qa/forensics.json',
  ]);
  await step('av-audit', [
    'av-audit',
    'out/preview.mp4',
    '--cues',
    'out/cues.json',
    '--stems',
    'out/stems',
    '--json',
    'out/qa/av.json',
  ]);
  await step('lint-negative', ['lint'], {expectFailure: true}); // Original starter intentionally has placeholder markers.
  await step('hf-cues', ['cues'], {p: hf});
  await step('hf-audio', ['audio'], {p: hf});
  await step(
    'hf-master',
    ['hf-finish', 'out/master.mp4', '--audio', 'public/audio/soundtrack.wav', '--blur', '2'],
    {p: hf},
  );
  await step('hf-deliver', ['deliver', 'out/master.mp4', '--out-dir', 'out/deliver'], {p: hf});
  await step('hf-font', ['add-font', 'geist'], {p: hf});
  await step(
    'hf-snapshot',
    ['hyperframes', 'snapshot', '--at', '1,2', '--output', 'out/snapshots'],
    {p: hf},
  );
  await step('preview-servers', [project, hf, path.join(root, 'previews.json')], {
    script: 'scripts/native-preview-acceptance.mjs',
  });
  await step('alpha-pixels', [project, path.join(root, 'alpha.json')], {
    script: 'scripts/native-alpha-acceptance.mjs',
  });
  // All important output facts and hashes are retained, never substituted with successful mocks.
  const artifacts = [];
  for (const [p, f] of [
    [project, 'out/preview.mp4'],
    [project, 'out/full-master.mp4'],
    [project, 'out/blur10.mp4'],
    [project, 'out/deliver/Alpha.mov'],
    [project, 'out/deliver/Alpha-alpha.webm'],
    [hf, 'out/master.mp4'],
    [project, 'out/deliver/loop.gif'],
    [project, 'out/deliver/loop.webm'],
    [project, 'out/deliver/Square.mp4'],
    [project, 'out/deliver/Portrait.mp4'],
  ]) {
    const file = abs(p, f);
    artifacts.push({
      file,
      bytes: (await stat(file)).size,
      sha256: createHash('sha256')
        .update(await readFile(file))
        .digest('hex'),
      ffprobe: (await probe(await context(p), file)).raw,
    });
  }
  await writeJson(path.join(root, 'results.json'), {
    platform: process.platform,
    node: process.version,
    upstream: (await json(path.join(repositoryRoot, 'third_party/cinetic/provenance.json')))
      .revision,
    project,
    hf,
    results,
    artifacts,
    pass: true,
    complete: true,
    shipReady: false,
  });
  console.log(`Acceptance passed: ${root}`);
} catch (e) {
  console.error(e.stack);
  process.exitCode = 1;
  console.log(`Evidence: ${root}`);
}
