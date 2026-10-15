import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {repositoryRoot, verifyVendor} from '../src/cinetic-adapter/workspace.mjs';

function run(executable, args) {
  const result = spawnSync(executable, args, {
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    timeout: 15000,
    maxBuffer: 4 * 1024 * 1024,
  });
  return {
    ok: !result.error && result.status === 0,
    output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim(),
    error: result.error?.message,
  };
}

const checks = [];
function check(name, ok, detail) {
  checks.push({name, ok, detail});
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${detail}`);
}

const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
check('Node.js >=22.9', nodeMajor > 22 || (nodeMajor === 22 && nodeMinor >= 9), process.version);

const git = run('git', ['--version']);
check('Git', git.ok, git.output || git.error || 'Unavailable');

const localPython = path.join(repositoryRoot, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
const pythonCandidates = process.env.PYTHON_PATH
  ? [[process.env.PYTHON_PATH, []]]
  : existsSync(localPython) ? [[localPython, []]]
  : process.platform === 'win32'
    ? [['python', []], ['py', ['-3']], ['python3', []]]
    : [['python3', []], ['python', []]];
let python;
for (const [executable, prefix] of pythonCandidates) {
  const result = run(executable, [...prefix, '-c', 'import sys; print(sys.version.split()[0]); sys.exit(0 if sys.version_info >= (3, 11) else 1)']);
  if (result.ok) {
    python = {executable, prefix, ...result};
    break;
  }
}
check('Python >=3.11', Boolean(python), python ? `${python.executable}: ${python.output}` : 'Install Python 3.11+ or set PYTHON_PATH to its executable.');

for (const executable of ['ffmpeg', 'ffprobe']) {
  const result = run(executable, ['-version']);
  const version = result.output.match(/version\s+(?:n)?(\d+)\./i);
  check(`${executable} >=6`, result.ok && Boolean(version) && Number(version[1]) >= 6,
    result.output.split(/\r?\n/)[0] || result.error || 'Unavailable');
}
const encoders = run('ffmpeg', ['-hide_banner', '-encoders']);
check('FFmpeg libx264', encoders.ok && /\blibx264\b/.test(encoders.output),
  /\blibx264\b/.test(encoders.output) ? 'Encoder available' : 'Install an FFmpeg build with libx264.');

if (process.argv.includes('--render')) {
  const imports = python && run(python.executable, [...python.prefix, '-c', 'import numpy, scipy, soundfile, pyloudnorm, cv2; print("Audio/QA imports OK")']);
  check('Python audio/QA packages', Boolean(imports?.ok), imports?.output || 'Create .venv and install requirements-render.txt.');
  const manifest = JSON.parse(readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'));
  for (const [name, expected] of Object.entries(manifest.dependencies).filter(([name]) => name === 'remotion' || name.startsWith('@remotion/'))) {
    try {
      const actual = JSON.parse(readFileSync(path.join(repositoryRoot, 'node_modules', name, 'package.json'), 'utf8')).version;
      check(name, actual === expected, `${actual} (expected ${expected})`);
    } catch { check(name, false, 'Run npm.cmd ci.'); }
  }
  try { await verifyVendor(); check('Cinetic provenance', true, 'Pinned source hashes match.'); }
  catch (error) { check('Cinetic provenance', false, error.message); }
  let browser;
  try { browser = JSON.parse(readFileSync(path.join(repositoryRoot, 'data/browser.json'), 'utf8')).path; } catch { /* First setup. */ }
  const browserPath = process.env.REMOTION_BROWSER || process.env.CHROMIUM_PATH || browser;
  const browserResult = browserPath && run(browserPath, ['--version']);
  check('Chromium executable', Boolean(browserResult?.ok), browserResult?.output || 'Run npm.cmd run browser:install.');
  console.log('\nPreflight only. Each render must still pass its output and audio gates.');
} else {
  console.log('\nExecutable checks only. Use npm.cmd run doctor:render for renderer preflight.');
}
if (checks.some(({ok}) => !ok)) process.exitCode = 1;
