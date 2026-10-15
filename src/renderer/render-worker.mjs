import {bundle} from '@remotion/bundler';
import {selectComposition, renderMedia} from '@remotion/renderer';
import {readFile, rename, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {repositoryRoot, resolveProject, json, writeJson, validateSettings, verifyVendor} from '../cinetic-adapter/workspace.mjs';
import {run} from './process.mjs';

const [input, mode, concurrencyText] = process.argv.slice(2);
// The parent owns cancellation and terminates this worker's whole process tree.
process.on('SIGINT', () => {});
process.on('SIGTERM', () => {});
const project = await resolveProject(input);
const spec = await json(path.join(project, 'film.json'));
validateSettings(spec);
if (!['preview', 'master'].includes(mode) || !/^[1-4]$/.test(concurrencyText)) throw new Error('Invalid render settings.');
const provenance = await verifyVendor();
if (spec.upstream !== provenance.revision) throw new Error('Film upstream revision does not match the adapter.');
const state = async (value) => {
  console.log(`[${new Date().toISOString()}] ${value}`);
  await writeJson(path.join(project, 'status.json'), {state: value, mode, updatedAt: new Date().toISOString()});
};
const env = {...process.env, PYTHONUTF8: '1', PYTHONDONTWRITEBYTECODE: '1'};
const execute = (tool, args, quiet = false) => run(tool, args, {cwd: project, env, processGroup: false, onOutput: (text) => { if (!quiet) process.stdout.write(text); }});
const python = process.env.PYTHON_PATH || path.join(repositoryRoot, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
const py = (script, args = []) => execute(python, [path.join(project, 'scripts', script), ...args]);
const runId = `${Date.now()}-${process.pid}`;
const work = path.join(project, 'out', `work-${runId}`);
await mkdir(work, {recursive: true});
await state('preparing');
const versions = {
  node: process.version,
  python: (await execute(python, ['--version'], true)).trim(),
  ffmpeg: (await execute('ffmpeg', ['-version'], true)).split(/\r?\n/)[0],
  ffprobe: (await execute('ffprobe', ['-version'], true)).split(/\r?\n/)[0],
  remotion: (await json(path.join(repositoryRoot, 'node_modules/remotion/package.json'))).version,
  upstream: provenance.revision,
  platform: `${process.platform}-${process.arch}`,
};
await execute(python, ['-c', 'import numpy, scipy, soundfile, pyloudnorm, cv2; print("Python audio/QA imports OK")']);
const browserRecord = await json(path.join(repositoryRoot, 'data/browser.json')).catch(() => null);
const browserExecutable = process.env.REMOTION_BROWSER || process.env.CHROMIUM_PATH || browserRecord?.path;
if (!browserExecutable) throw new Error('No configured browser. Run npm.cmd run browser:install first.');
versions.browser = (await execute(browserExecutable, ['--version'], true)).trim();
await writeJson(path.join(project, 'out/qa/versions.json'), versions);
await execute(process.execPath, [path.join(repositoryRoot, 'node_modules/tsx/dist/cli.mjs'), 'scripts/grid-check.ts', 'src/timeline.ts']);
await execute(process.execPath, [path.join(repositoryRoot, 'node_modules/tsx/dist/cli.mjs'), 'scripts/export-cues.ts']);
await py('audio/score.py', ['--cues', 'out/cues.json', '--score', 'audio/score.json', '--out', 'public/audio/soundtrack.wav', '--stems', 'out/stems', '--json', 'out/qa/score.json']);
const cues = await json(path.join(project, 'out/cues.json'));
const serveUrl = await bundle({entryPoint: path.join(project, 'src/index.ts'), outDir: path.join(work, 'bundle'), publicDir: path.join(project, 'public'), rootDir: repositoryRoot, enableCaching: true});
const browserOptions = {browserExecutable, chromiumOptions: {gl: 'angle'}, timeoutInMilliseconds: 120000};
const composition = await selectComposition({serveUrl, id: 'Film', ...browserOptions});
if (composition.width !== spec.width || composition.height !== spec.height || composition.fps !== spec.fps || composition.durationInFrames !== cues.total) throw new Error('Composition metadata differs from film specification/cues.');
await state('rendering');
let lastProgress = -1;
const picture = path.join(work, 'picture.mp4');
await renderMedia({serveUrl, composition, outputLocation: picture, codec: 'h264', muted: true, crf: mode === 'preview' ? 20 : 14, x264Preset: mode === 'preview' ? 'veryfast' : 'slow', pixelFormat: 'yuv420p', colorSpace: 'bt709', imageFormat: 'jpeg', jpegQuality: 95, concurrency: Number(concurrencyText), ...browserOptions,
  onProgress: ({progress}) => { const percent = Math.floor(progress * 10) * 10; if (percent !== lastProgress) { console.log(`Picture ${percent}%`); lastProgress = percent; } },
});
const candidate = path.join(work, 'candidate.mp4');
await execute('ffmpeg', ['-v', 'error', '-y', '-i', picture, '-i', 'public/audio/soundtrack.wav', '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-af', 'apad', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-ac', '2', '-t', String(cues.total / spec.fps), '-movflags', '+faststart', candidate]);
await state('verifying');
await py('check-sync.py', [candidate, 'public/audio/soundtrack.wav', '--json', 'out/qa/sync.json']);
await py('probe.py', [candidate, '--spec', `${spec.width}x${spec.height}@${spec.fps}`, '--frames', String(cues.total), '--lufs', '-14', '--tp-max', '-1', '--json', 'out/qa/probe.json']);
await py('sheet.py', [candidate, '--every', String(Math.round(spec.fps / 2)), '--width', '480', '--cols', '4', '--cues', 'out/cues.json', '--out', 'out/qa/contact-sheet.png']);
// Rendering success and creative acceptance are distinct. Keep real audit failures.
const audit = async (action) => {
  try { await action(); return {pass: true}; }
  catch (error) {
    if (error.code !== 'PROCESS_FAILED') throw error;
    return {pass: false, message: error.message};
  }
};
const creative = {
  lint: await audit(() => execute(process.execPath, ['scripts/lint-film.mjs', 'src'])),
  forensics: await audit(() => py('forensics.py', [candidate, '--cues', 'out/cues.json', '--json', 'out/qa/forensics.json'])),
};
await writeJson(path.join(project, 'out/qa/creative.json'), creative);
const probe = JSON.parse(await execute('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', candidate], true));
await writeJson(path.join(project, 'out/qa/ffprobe.json'), probe);
const output = path.join(project, 'out', `${mode}-${runId}.mp4`);
await rename(candidate, output);
await writeJson(path.join(project, 'out/qa/acceptance.json'), {mode, output, sha256: createHash('sha256').update(await readFile(output)).digest('hex'), versions, width: spec.width, height: spec.height, fps: spec.fps, frames: cues.total, durationSeconds: cues.total / spec.fps, gates: ['score', 'grid', 'audio-sync', 'probe'], creative, shipReady: false, limitations: ['Cinetic starter placeholder brand', 'Motion blur not implemented', 'Contact sheet requires visual review; no creative approval']});
await writeJson(path.join(project, 'status.json'), {state: 'succeeded', mode, output, updatedAt: new Date().toISOString(), technicalQaPassed: true, creativeQaPassed: creative.lint.pass && creative.forensics.pass, shipReady: false});
await writeFile(path.join(project, 'out', 'LATEST.txt'), `${output}\n`);
console.log('All technical gates passed. Starter demo; not a ship-ready creative.');
