import {mkdir, mkdtemp, readFile, cp, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {repositoryRoot, vendorRoot, json, writeJson, resolveProject} from './workspace.mjs';
import {run} from '../renderer/process.mjs';
export {repositoryRoot, vendorRoot, json, writeJson};
export const require = createRequire(import.meta.url);
export const python =
  process.env.PYTHON_PATH ||
  path.join(
    repositoryRoot,
    '.venv',
    process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
  );
export const remotionCli = path.join(
  path.dirname(require.resolve('@remotion/cli/package.json')),
  'remotion-cli.js',
);
export const tsxCli = path.join(repositoryRoot, 'node_modules/tsx/dist/cli.mjs');
export const helpers = path.join(repositoryRoot, 'src/cinetic-adapter/helpers');
export const upstreamScripts = path.join(vendorRoot, 'release/scripts');
export const exists = existsSync;
export const abs = (p, f) => path.resolve(p, f);
export async function context(input) {
  const project = await resolveProject(input);
  const spec = await json(path.join(project, 'film.json'));
  const record = await json(path.join(repositoryRoot, 'data/browser.json')).catch(() => null);
  const browser =
    process.env.REMOTION_BROWSER || process.env.CHROMIUM_PATH || spec.browser || record?.path;
  if (!exists(browser)) throw Error('Browser missing; run npm.cmd run browser:install');
  const env = {
    ...process.env,
    PYTHONUTF8: '1',
    PYTHONDONTWRITEBYTECODE: '1',
    PYTHON_PATH: python,
    CINETIC_ROOT: repositoryRoot,
    CINETIC_REMOTION_CLI: remotionCli,
    CINETIC_NODE: process.execPath,
    REMOTION_BROWSER: browser,
    CHROMIUM_PATH: browser,
    HYPERFRAMES_BROWSER_PATH: browser,
    PRODUCER_HEADLESS_SHELL_PATH: browser,
    HYPERFRAMES_SKIP_SKILLS: '1',
    HYPERFRAMES_TELEMETRY_DISABLED: '1',
    DO_NOT_TRACK: '1',
    HYPERFRAMES_NO_TELEMETRY: '1',
    TMP: abs(project, 'out/tmp'),
    TEMP: abs(project, 'out/tmp'),
    TMPDIR: abs(project, 'out/tmp'),
  };
  await mkdir(env.TMP, {recursive: true});
  const execute = (exe, args, opts = {}) =>
    run(exe, args.map(String), {
      cwd: project,
      env,
      processGroup: false,
      timeoutMs: 3600000,
      ...opts,
    });
  env.PYTHONPATH =
    path.join(repositoryRoot, 'src/cinetic-adapter/python') +
    (process.env.PYTHONPATH ? path.delimiter + process.env.PYTHONPATH : '');
  const node = (script, args = [], opts) => execute(process.execPath, [script, ...args], opts);
  const py = (script, args = [], opts) =>
    execute(
      python,
      [path.isAbsolute(script) ? script : path.join(project, 'scripts', script), ...args],
      opts,
    );
  const cli = (args, opts) =>
    node(remotionCli, [...args, `--browser-executable=${browser}`, '--gl=angle'], opts);
  return {project, browser, env, execute, node, py, cli, entry: spec.entry || 'src/index.ts'};
}
export async function workdir(project, prefix) {
  await mkdir(abs(project, 'out/work'), {recursive: true});
  return mkdtemp(abs(project, `out/work/${prefix}-`));
}
export async function probe(c, file) {
  const d = JSON.parse(
    await c.execute('ffprobe', [
      '-v',
      'error',
      '-count_packets',
      '-show_streams',
      '-show_format',
      '-of',
      'json',
      file,
    ]),
  );
  const v = d.streams.find((s) => s.codec_type === 'video');
  if (!v) throw Error('No video stream');
  const [a, b] = v.avg_frame_rate.split('/').map(Number);
  return {
    ...v,
    fps: a / b,
    frames: Number(v.nb_read_packets),
    audio: d.streams.some((s) => s.codec_type === 'audio'),
    raw: d,
  };
}
export async function copyScripts(project) {
  await cp(upstreamScripts, abs(project, 'scripts'), {
    recursive: true,
    filter: (source) => !source.endsWith('.sh'),
  });
  // Only generated files are adapted; original provenance sources remain byte-for-byte intact.
  const sheet = abs(project, 'scripts/sheet.py');
  let source = await readFile(sheet, 'utf8');
  source = source
    .replace('import re', 'import os\nimport re')
    .replaceAll(
      "['npx', 'remotion',",
      "[os.environ['CINETIC_NODE'], os.environ['CINETIC_REMOTION_CLI'],",
    );
  source = source.replace(
    'cmd += args.extra',
    "cmd += ['--browser-executable=' + os.environ['REMOTION_BROWSER'], '--gl=angle']\n    cmd += args.extra",
  );
  source = source.replace(
    "'compositions', entry]",
    "'compositions', entry, '--browser-executable=' + os.environ['REMOTION_BROWSER'], '--gl=angle']",
  );
  await writeFile(sheet, source);
  const svg = abs(project, 'scripts/brand-svg.ts');
  source = await readFile(svg, 'utf8');
  source = source.replace("execFileSync('python3',", 'execFileSync(process.env.PYTHON_PATH!,');
  source = source.replace(
    "join(root, 'node_modules/@fontsource-variable',",
    "join(process.env.CINETIC_ROOT || root, 'node_modules/@fontsource-variable',",
  );
  await writeFile(svg, source);
  const font = abs(project, 'scripts/add-font.mjs');
  source = await readFile(font, 'utf8');
  source = source.replace(
    'import { execFileSync }',
    "import { x as extract } from 'tar';\nimport { execFileSync }",
  );
  source = source.replace(
    "let root = join(dir, 'node_modules', pkg);",
    "let root = join(dir, 'node_modules', pkg);\nif (!existsSync(root)) root = join(process.env.CINETIC_ROOT, 'node_modules', pkg);",
  );
  source = source.replace(
    "execFileSync('npm', ['pack',",
    "execFileSync(process.execPath, [process.env.CINETIC_NPM_CLI, 'pack',",
  );
  source = source.replace(
    "execFileSync('tar', ['-xzf', join(tmp, out), '-C', tmp]);",
    'await extract({file:join(tmp,out),cwd:tmp,strict:true,preservePaths:false});',
  );
  // No recursive delete is necessary: preserve old font files, and retain npm temp evidence.
  source = source.replace(/rmSync\(tmp, \{ recursive: true, force: true \}\)/g, 'void tmp');
  source = source.replace(/rmSync\(dst, \{ recursive: true, force: true \}\);?/g, '');
  await writeFile(font, source);
  const accum = abs(project, 'scripts/accumulate.py');
  source = await readFile(accum, 'utf8');
  // FFmpeg's Windows builds omit glob. A concat demuxer accepts ordered arbitrary filenames.
  source = source.replace(
    "return ['-framerate', str(in_fps), '-pattern_type', 'glob', '-i', src], sorted(glob.glob(src))[0], True",
    `imgs = sorted(glob.glob(src))
        if not imgs:
            fail('empty image sequence')
        import tempfile
        fd, manifest = tempfile.mkstemp(prefix='cinetic-frames-', suffix='.ffconcat')
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            for image in imgs:
                escaped = os.path.abspath(image).replace('\\\\', '/').replace("'", "'\\\\''")
                f.write("file '" + escaped + "'\\n" + 'duration ' + str(1 / in_fps) + '\\n')
        return ['-f', 'concat', '-safe', '0', '-r', str(in_fps), '-i', manifest], imgs[0], True`,
  );
  await writeFile(accum, source);
}
export async function movieBundle(c, entry = c.entry || 'src/index.ts') {
  const work = await workdir(c.project, 'bundle');
  const {bundle} = await import('@remotion/bundler');
  return bundle({
    entryPoint: abs(c.project, entry),
    outDir: path.join(work, 'site'),
    publicDir: abs(c.project, 'public'),
    rootDir: repositoryRoot,
    enableCaching: true,
  });
}
export async function metadata(c, site, id = 'Film', inputProps = {}) {
  const {selectComposition} = await import('@remotion/renderer');
  return selectComposition({
    serveUrl: site,
    id,
    inputProps,
    browserExecutable: c.browser,
    chromiumOptions: {gl: 'angle'},
  });
}
export async function still(c, site, comp, out, props = {}, frame = 0) {
  await mkdir(path.dirname(out), {recursive: true});
  await c.cli([
    'still',
    site,
    comp,
    out,
    `--props=${JSON.stringify(props)}`,
    `--frame=${frame}`,
    '--image-format=png',
    '--log=error',
  ]);
}
export function int(value, min, max, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max)
    throw Error(`${label} must be an integer ${min}..${max}`);
  return n;
}
export function frameRange(text, total) {
  if (text === undefined) return [0, total - 1];
  const m = /^(\d+)-(\d+)$/.exec(String(text));
  if (!m) throw Error('Frames must be inclusive A-B');
  const a = int(m[1], 0, total - 1, 'first frame'),
    b = int(m[2], a, total - 1, 'last frame');
  return [a, b];
}
