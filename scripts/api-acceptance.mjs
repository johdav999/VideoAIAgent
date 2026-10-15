// Real native acceptance; no injected worker or simulated render results.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {createServer} from 'node:net';
import {repositoryRoot} from '../src/cinetic-adapter/workspace.mjs';
import {atomicJson} from '../src/shared/files.mjs';
import {run} from '../src/renderer/process.mjs';

const directory = path.join(repositoryRoot, 'data', `api-acceptance-${Date.now()}`);
await mkdir(directory, {recursive: true});
console.log(`Acceptance workspace: ${directory}`);
const reservation = createServer();
await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const base = `http://127.0.0.1:${port}`;
let server;
let logs = '';
const report = {base, directory, cases: []};
const env = {...process.env, PORT: String(port), VIDEO_DATA_DIR: path.join(directory, 'store')};
const spec = JSON.parse(
  await readFile(path.join(repositoryRoot, 'examples/product-launch.json'), 'utf8'),
);
spec.brand.logoDataUrl = `data:image/png;base64,${(await readFile(path.join(repositoryRoot, 'examples/logo.png'))).toString('base64')}`;
async function start(overrides = {}) {
  server = spawn(process.execPath, [path.join(repositoryRoot, 'src/api/main.mjs')], {
    cwd: repositoryRoot,
    env: {...env, ...overrides},
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const stream of [server.stdout, server.stderr])
    stream.setEncoding('utf8').on('data', (text) => {
      logs += text;
    });
  for (let i = 0; i < 150; i++) {
    if (server.exitCode !== null || server.signalCode !== null)
      throw new Error(`Service exited: ${logs}`);
    try {
      if ((await fetch(`${base}/health`)).ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error('Service startup timed out.');
}
async function stop(hard = false) {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;
  const current = server;
  const closed = new Promise((resolve) => current.once('close', resolve));
  if (process.platform === 'win32') {
    try {
      await run('taskkill.exe', ['/PID', String(current.pid), '/T', '/F'], {timeoutMs: 10000});
    } catch (error) {
      // The worker watchdog can finish tree cleanup while taskkill is enumerating.
      // A nonzero exit is acceptable only after the exact owned server PID is gone.
      try {
        process.kill(current.pid, 0);
        throw error;
      } catch (probe) {
        if (probe.code !== 'ESRCH') throw error;
      }
    }
  } else current.kill(hard ? 'SIGKILL' : 'SIGTERM');
  await closed;
  server = null;
}
async function submit(body = spec, key) {
  const response = await fetch(`${base}/v1/video-jobs`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', ...(key ? {'Idempotency-Key': key} : {})},
    body: JSON.stringify(body),
  });
  assert.ok(response.status === 202 || response.status === 200, await response.clone().text());
  return response.json();
}
async function wait(id, condition, seconds = 180) {
  for (let i = 0; i < seconds * 5; i++) {
    const response = await fetch(`${base}/v1/video-jobs/${id}`);
    assert.equal(response.status, 200);
    const job = await response.json();
    if (condition(job)) return job;
    if (job.state === 'failed') throw new Error(`Job ${id} failed: ${JSON.stringify(job)}`);
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${id}`);
}
async function record(name, value) {
  report.cases.push({name, ...value});
  await atomicJson(path.join(directory, 'report.json'), report);
}
try {
  await start();
  const primary = await submit(spec, 'native-windows-e2e');
  assert.equal((await submit(spec, 'native-windows-e2e')).id, primary.id);
  await wait(primary.id, (job) => job.state === 'rendering' && job.progress.percent > 10);
  const queued = await submit({...spec, title: 'Waiting in the queue'});
  assert.equal(queued.state, 'queued');
  await fetch(`${base}/v1/video-jobs/${queued.id}/cancel`, {method: 'POST'});
  const cancelled = await wait(queued.id, (job) => job.state === 'cancelled');
  assert.equal(cancelled.attempts, 0);
  await record('queued cancellation', {job: cancelled});
  const completed = await wait(primary.id, (job) => job.state === 'succeeded');
  assert.equal(completed.result.technicalQaPassed, true);
  assert.equal(completed.result.creativeQaPassed, true);
  const bytes = Buffer.from(await (await fetch(`${base}${completed.result.url}`)).arrayBuffer());
  const hash = createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash, completed.result.sha256);
  await writeFile(path.join(directory, 'sample.mp4'), bytes);
  await record('JSON to verified MP4 with embedded PNG', {job: completed, sha256: hash});
  await stop(true);
  await start();
  const restored = await wait(primary.id, (job) => job.state === 'succeeded');
  assert.equal(restored.attempts, 1);
  assert.equal(
    createHash('sha256')
      .update(Buffer.from(await (await fetch(`${base}${restored.result.url}`)).arrayBuffer()))
      .digest('hex'),
    hash,
  );
  assert.equal((await submit(spec, 'native-windows-e2e')).id, primary.id);
  await record('completed artifact and idempotency survive restart', {
    id: primary.id,
    sha256: hash,
  });
  const interrupted = await submit({...spec, title: 'Resume after a restart', durationSeconds: 8});
  await wait(interrupted.id, (job) => job.state === 'rendering');
  const waiting = await submit({
    ...spec,
    title: 'Keep queued work after restart',
    durationSeconds: 8,
  });
  assert.equal(waiting.state, 'queued');
  await stop(true);
  await start();
  const recovered = await wait(interrupted.id, (job) => job.state === 'succeeded');
  assert.equal(recovered.attempts, 2);
  assert.equal(recovered.recoveries, 1);
  await record('hard restart resumes interrupted job', {job: recovered});
  const resumedQueue = await wait(waiting.id, (job) => job.state === 'succeeded');
  assert.equal(resumedQueue.attempts, 1);
  await record('queued job survives hard restart', {job: resumedQueue});
  const active = await submit({...spec, title: 'Cancellation acceptance'});
  await wait(active.id, (job) => job.state === 'rendering');
  await fetch(`${base}/v1/video-jobs/${active.id}/cancel`, {method: 'POST'});
  const activeCancelled = await wait(active.id, (job) => job.state === 'cancelled');
  assert.equal((await fetch(`${base}/v1/video-jobs/${active.id}/video`)).status, 409);
  await record('active rendering cancellation', {job: activeCancelled});
  await stop(true);
  await start({PYTHON_PATH: path.join(directory, 'missing-python.exe')});
  const failed = await submit({...spec, title: 'Dependency failure acceptance'});
  const failure = await wait(failed.id, (job) => job.state === 'failed');
  await stop(true);
  await start();
  const preserved = await wait(failed.id, (job) => job.state === 'failed');
  assert.equal(preserved.attempts, 1);
  await record('failed job survives restart without automatic retry', {job: failure});
  const retry = await fetch(`${base}/v1/video-jobs/${failed.id}/retry`, {method: 'POST'});
  assert.equal(retry.status, 202);
  const retried = await wait(failed.id, (job) => job.state === 'succeeded');
  assert.equal(retried.attempts, 2);
  await record('explicit retry produces real video', {job: retried});
  console.log(`Native API acceptance passed.\n${directory}\n${path.join(directory, 'sample.mp4')}`);
} finally {
  try {
    await stop(true);
  } finally {
    await writeFile(path.join(directory, 'server.log'), logs);
  }
}
