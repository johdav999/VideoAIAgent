import assert from 'node:assert/strict';
import {once} from 'node:events';
import test from 'node:test';
import {createApiServer} from '../src/api/server.mjs';

test('foundation reports its actual capabilities and does not accept video jobs', async (t) => {
  const server = createApiServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);
  assert.match(health.headers.get('content-type'), /application\/json/);
  assert.deepEqual(await health.json(), {
    service: 'VideoAIAgent',
    status: 'scaffold',
    capabilities: {rendering: false, cineticWindows: false, jobQueue: false, azureStorage: false},
  });

  for (const [method, path] of [['POST', '/v1/video-jobs'], ['POST', '/health'], ['GET', '/missing']]) {
    const response = await fetch(`${baseUrl}${path}`, {method});
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {error: 'Not found'});
  }
});
