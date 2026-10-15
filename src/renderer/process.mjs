import {spawn} from 'node:child_process';

// Each top-level worker owns its descendants. Never kill by executable name.
export function run(executable, args, {cwd, env = process.env, timeoutMs = 600000, signal, processGroup = true, onOutput = () => {}} = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(Object.assign(new Error('Cancelled before starting.'), {code: 'CANCELLED'}));
    const detached = process.platform !== 'win32' && processGroup;
    const child = spawn(executable, args, {cwd, env, shell: false, windowsHide: true, detached, stdio: ['ignore', 'pipe', 'pipe']});
    let output = '';
    let reason;
    let timer;
    const stop = (code) => {
      if (reason) return;
      reason = code;
      if (!child.pid) return;
      if (process.platform === 'win32') {
        const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {shell: false, windowsHide: true, stdio: 'ignore'});
        killer.on('error', () => child.kill());
        killer.on('close', (code) => { if (code !== 0) child.kill(); });
      } else {
        try { detached ? process.kill(-child.pid, 'SIGKILL') : child.kill('SIGKILL'); } catch { child.kill(); }
      }
    };
    const cancel = () => stop('CANCELLED');
    signal?.addEventListener('abort', cancel, {once: true});
    timer = setTimeout(() => stop('TIMEOUT'), timeoutMs);
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); };
    child.on('error', (error) => { cleanup(); reject(Object.assign(new Error(`Cannot start ${executable}: ${error.message}`), {code: 'START_FAILED'})); });
    for (const stream of [child.stdout, child.stderr]) stream.on('data', (data) => {
      const text = data.toString();
      output = (output + text).slice(-128000);
      onOutput(text);
    });
    child.on('close', (code) => {
      cleanup();
      if (reason || code !== 0) reject(Object.assign(new Error(`${executable}: ${reason ?? `exit ${code}`}\n${output.slice(-4000)}`), {code: reason ?? 'PROCESS_FAILED'}));
      else resolve(output);
    });
  });
}
