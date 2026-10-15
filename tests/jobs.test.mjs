import assert from 'node:assert/strict';
import test, {after} from 'node:test';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {JobManager} from '../src/jobs/manager.mjs';
import {validateSpecification} from '../src/jobs/specification.mjs';
import {createApiServer} from '../src/api/server.mjs';
import {repositoryRoot} from '../src/cinetic-adapter/workspace.mjs';
import {atomicJson} from '../src/shared/files.mjs';

const sample = {
  schemaVersion: 1,
  template: 'product-launch',
  title: 'Build together',
  message: 'Specialist agents coordinate your work.',
  callToAction: 'Start today',
  durationSeconds: 8,
  width: 640,
  height: 360,
  fps: 30,
  brand: {name: 'Virtual Company'},
};
const stalled = (_job, {signal}) =>
  new Promise((_, reject) => {
    if (signal.aborted) reject(Object.assign(new Error('cancelled'), {code: 'CANCELLED'}));
    else
      signal.addEventListener(
        'abort',
        () => reject(Object.assign(new Error('cancelled'), {code: 'CANCELLED'})),
        {once: true},
      );
  });
const cleanupRoots = [];
after(async () => {
  const base = path.resolve(repositoryRoot, 'data/test-jobs');
  for (const directory of cleanupRoots) {
    assert.equal(path.dirname(path.resolve(directory)), base);
    await rm(directory, {recursive: true, force: true});
  }
});
async function root() {
  const base = path.join(repositoryRoot, 'data/test-jobs');
  await mkdir(base, {recursive: true});
  const directory = await mkdtemp(path.join(base, 'case-'));
  cleanupRoots.push(directory);
  return directory;
}
async function until(predicate) {
  for (let attempt = 0; attempt < 250; attempt++) {
    if (await predicate()) return;
    await delay(20);
  }
  throw new Error('State transition timed out');
}

test('specification rejects executable paths, invalid logos, excessive sizes and unreadable palettes', () => {
  assert.equal(validateSpecification(sample).brand.background, '#101A2E');
  for (const change of [
    {command: 'ffmpeg'},
    {durationSeconds: 100},
    {fps: 48},
    {width: 1279},
    {width: null},
    {title: '\u0000'},
    {brand: {name: 'A', background: null}},
    {brand: {name: 'A', logoDataUrl: 'https://example.com/logo.png'}},
    {brand: {name: 'A', background: '#000000', foreground: '#000001'}},
    {brand: {name: 'A', logoDataUrl: 'data:image/png;base64,AA=='}},
  ])
    assert.throws(() => validateSpecification({...sample, ...change}), {
      code: 'INVALID_SPECIFICATION',
    });
});

test('durable idempotency, queued cancellation and exclusive store ownership', async (t) => {
  const directory = await root(t);
  const manager = await new JobManager({root: directory, execute: stalled}).start();
  t.after(() => manager.close());
  const results = await Promise.all(
    Array.from({length: 10}, () => manager.submit(sample, 'same-key')),
  );
  assert.equal(new Set(results.map((value) => value.job.id)).size, 1);
  await assert.rejects(manager.submit({...sample, title: 'Different'}, 'same-key'), {
    code: 'IDEMPOTENCY_CONFLICT',
  });
  await assert.rejects(
    new JobManager({root: directory, execute: stalled}).start(),
    /already owned/,
  );
  const next = await manager.submit(sample);
  assert.equal((await manager.cancel(next.job.id)).state, 'cancelled');
  assert.equal(manager.get(next.job.id).attempts, 0);
  await manager.cancel(results[0].job.id);
  await until(() => manager.get(results[0].job.id).state === 'cancelled');
});

test('shutdown resumes interrupted and queued jobs, while failure persists until explicit retry', async (t) => {
  const directory = await root(t);
  let manager = await new JobManager({root: directory, execute: stalled}).start();
  t.after(() => manager.close());
  const one = (await manager.submit(sample, 'restart-key')).job;
  await until(() => manager.get(one.id).state === 'preparing');
  const two = (await manager.submit(sample)).job;
  await manager.close();
  assert.equal(manager.get(one.id).state, 'queued');
  manager = await new JobManager({
    root: directory,
    execute: async () => {
      throw new Error('controlled unit worker failure');
    },
  }).start();
  await until(() => manager.get(two.id).state === 'failed');
  assert.equal(manager.get(one.id).attempts, 2);
  await manager.close();
  let executions = 0;
  manager = await new JobManager({
    root: directory,
    execute: async () => {
      executions++;
      return {unitFixture: true};
    },
  }).start();
  assert.equal(manager.get(one.id).state, 'failed');
  assert.equal(executions, 0);
  assert.equal((await manager.submit(sample, 'restart-key')).replayed, true);
  await manager.retry(one.id);
  await until(() => manager.get(one.id).state === 'succeeded');
  assert.equal(executions, 1);
  assert.equal(manager.get(two.id).state, 'failed');
});

test('dead owner and interrupted on-disk job recover without replaying a completed job', async (t) => {
  const directory = await root(t);
  let manager = await new JobManager({root: directory, execute: stalled}).start();
  const job = (await manager.submit(sample)).job;
  await until(() => manager.get(job.id).state === 'preparing');
  await manager.close();
  const persisted = manager.get(job.id);
  persisted.state = 'rendering';
  await atomicJson(path.join(directory, 'jobs', `${job.id}.json`), persisted);
  await mkdir(path.join(directory, '.owner.lock'));
  await atomicJson(path.join(directory, '.owner.lock/owner.json'), {
    pid: 2147483647,
    token: 'dead-unit-owner',
  });
  manager = await new JobManager({
    root: directory,
    execute: async () => ({unitFixture: true}),
  }).start();
  t.after(() => manager.close());
  await until(() => manager.get(job.id).state === 'succeeded');
  assert.equal(manager.get(job.id).recoveries, 1);
  assert.equal(manager.get(job.id).attempts, 2);
});

test('HTTP submission, status, validation, video ranges and restart retrieval', async (t) => {
  const directory = await root(t);
  const project = path.join(directory, 'unit-artifact');
  await mkdir(path.join(project, 'out'), {recursive: true});
  const file = path.join(project, 'out/unit.mp4');
  const bytes = Buffer.from('unit fixture bytes, not a rendered MP4');
  await writeFile(file, bytes);
  let manager = await new JobManager({
    root: directory,
    execute: async (_job, {onEvent}) => {
      await onEvent({stage: 'rendering', percent: 50});
      return {file, project, bytes: bytes.length, sha256: 'unit-fixture'};
    },
  }).start();
  let server = createApiServer({jobs: manager});
  const listen = async () => {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return `http://127.0.0.1:${server.address().port}`;
  };
  const stop = async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await manager.close();
  };
  t.after(() => stop());
  let base = await listen();
  const response = await fetch(`${base}/v1/video-jobs`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'Idempotency-Key': 'http-unit'},
    body: JSON.stringify(sample),
  });
  assert.equal(response.status, 202);
  const job = await response.json();
  assert.ok(response.headers.get('location').endsWith(job.id));
  await until(() => manager.get(job.id).state === 'succeeded');
  const status = await (await fetch(`${base}${job.links.self}`)).json();
  assert.equal(status.progress.percent, 100);
  assert.ok(!('file' in status.result));
  const partial = await fetch(`${base}${status.result.url}`, {headers: {Range: 'bytes=5-11'}});
  assert.equal(partial.status, 206);
  assert.deepEqual(Buffer.from(await partial.arrayBuffer()), bytes.subarray(5, 12));
  assert.equal(
    (await fetch(`${base}${status.result.url}`, {headers: {Range: 'bytes=10000-'}})).status,
    416,
  );
  assert.equal(
    (await fetch(`${base}${status.result.url}`, {headers: {Range: 'bytes=-0'}})).status,
    416,
  );
  assert.equal(
    (
      await fetch(`${base}/v1/video-jobs`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: 'bad-json',
      })
    ).status,
    400,
  );
  assert.equal((await fetch(`${base}/v1/video-jobs`, {method: 'POST', body: '{}'})).status, 415);
  assert.equal(
    (await fetch(`${base}/v1/video-jobs`, {headers: {Origin: 'https://example.com'}})).status,
    403,
  );
  await stop();
  manager = await new JobManager({
    root: directory,
    execute: () => {
      throw new Error('completed job must not run again');
    },
  }).start();
  server = createApiServer({jobs: manager});
  base = await listen();
  assert.deepEqual(
    Buffer.from(await (await fetch(`${base}${status.result.url}`)).arrayBuffer()),
    bytes,
  );
  const replay = await fetch(`${base}/v1/video-jobs`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'Idempotency-Key': 'http-unit'},
    body: JSON.stringify(sample),
  });
  assert.equal(replay.headers.get('idempotency-replayed'), 'true');
});
