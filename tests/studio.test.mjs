import assert from 'node:assert/strict';
import test from 'node:test';
import {once} from 'node:events';
import {planBrief} from '../src/agent/brief-plan.mjs';
import {createApiServer} from '../src/api/server.mjs';
import {validateSpecification} from '../src/jobs/specification.mjs';

const brief =
  'Work better together. Bring plans, people and priorities into one place. Start building today.';
test('brief plans produce bounded readable declarative inputs without inventing a model', () => {
  for (const durationSeconds of [6, 8, 12, 20, 30])
    for (const format of ['landscape', 'portrait', 'square'])
      for (const palette of ['evergreen', 'ocean', 'graphite']) {
        const plan = planBrief({brief, brandName: 'Northstar', durationSeconds, format, palette});
        assert.equal(plan.method, 'local-extractive-v1');
        assert.deepEqual(validateSpecification(plan.specification), plan.specification);
        assert.ok(plan.specification.title.startsWith('Work better'));
      }
  const labeled = planBrief({
    brief: 'Title: A clearer day\nMessage: Priorities come together\nCall to action: Try Northstar',
  });
  assert.equal(labeled.specification.title, 'A clearer day');
  assert.equal(labeled.specification.callToAction, 'Try Northstar');
  const long = planBrief({
    brief: 'A long readable sentence with many useful words about a product. '.repeat(40),
  });
  assert.ok(long.shortened.length);
  assert.ok(long.specification.message.split(' ').length <= 10);
});
test('brief validation rejects executable options, control characters and invalid choices', () => {
  for (const input of [
    null,
    {},
    {brief: 'short'},
    {brief: 'x'.repeat(4001)},
    {brief: brief + '\u0000'},
    {brief, command: 'ffmpeg'},
    {brief, format: '__proto__'},
    {brief, palette: 'constructor'},
    {brief, durationSeconds: 7.5},
    {brief, brandName: 'one two three four five'},
  ])
    assert.throws(() => planBrief(input), {code: 'INVALID_BRIEF'});
});
test('studio assets and brief plans use the same local API origin and preserve the job contract', async (t) => {
  const submissions = [];
  const server = createApiServer({
    jobs: {
      submit: async (spec, key) => {
        submissions.push({spec, key});
        return {
          job: {
            id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            spec,
            state: 'queued',
            progress: {stage: 'queued', percent: 0},
          },
          replayed: false,
        };
      },
    },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {
    server.closeAllConnections();
    return new Promise((r) => server.close(r));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const home = await fetch(base);
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-type'), /text\/html/);
  assert.match(home.headers.get('content-security-policy'), /script-src 'self'/);
  assert.match(await home.text(), /Generate video/);
  for (const [url, type] of [
    ['/app.mjs', 'javascript'],
    ['/styles.css', 'text/css'],
    ['/assets/geist.woff2', 'font/woff2'],
  ]) {
    const response = await fetch(base + url);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), new RegExp(type));
  }
  assert.equal((await fetch(base + '/package.json')).status, 404);
  assert.equal((await fetch(base + '/src/api/main.mjs')).status, 404);
  assert.equal(
    (await fetch(base, {method: 'HEAD'})).headers.get('content-type'),
    'text/html; charset=utf-8',
  );
  const planResponse = await fetch(base + '/v1/video-plans', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({brief}),
  });
  assert.equal(planResponse.status, 200);
  const plan = await planResponse.json();
  const submitted = await fetch(base + '/v1/video-jobs', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'Idempotency-Key': 'studio-unit'},
    body: JSON.stringify(plan.specification),
  });
  assert.equal(submitted.status, 202);
  assert.equal(submissions[0].key, 'studio-unit');
  assert.equal(submissions[0].spec.title, plan.specification.title);
  const rejected = await fetch(base + '/v1/video-plans', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Origin: 'https://example.com'},
    body: JSON.stringify({brief}),
  });
  assert.equal(rejected.status, 403);
});
