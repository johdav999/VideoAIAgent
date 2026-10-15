import {spawnSync} from 'node:child_process';

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

const pythonCandidates = process.env.PYTHON_PATH
  ? [[process.env.PYTHON_PATH, []]]
  : process.platform === 'win32'
    ? [['python', []], ['py', ['-3']], ['python3', []]]
    : [['python3', []], ['python', []]];
let python;
for (const [executable, prefix] of pythonCandidates) {
  const result = run(executable, [...prefix, '-c', 'import sys; print(sys.version.split()[0]); sys.exit(0 if sys.version_info >= (3, 11) else 1)']);
  if (result.ok) {
    python = {executable, ...result};
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

console.log('\nScope: executable checks only. Cinetic, Python packages, Remotion and Chromium are not validated.');
console.log('Next milestone: implement the native Windows adapter and render a sample MP4.');
if (checks.some(({ok}) => !ok)) process.exitCode = 1;
