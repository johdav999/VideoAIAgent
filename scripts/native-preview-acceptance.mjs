import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {run} from '../src/renderer/process.mjs';
import {repositoryRoot} from '../src/cinetic-adapter/workspace.mjs';
const [project, hf, out] = process.argv.slice(2);
const results = [];
for (const [engine, p, args] of [
  ['remotion', project, ['remotion', 'studio', 'src/index.ts', '--no-open']],
  ['hyperframes', hf, ['hyperframes', 'preview', '--foreground', '--no-open', '--force-new']],
]) {
  const reservation = createServer();
  await new Promise((r) => reservation.listen(0, '127.0.0.1', r));
  const port = reservation.address().port;
  await new Promise((r) => reservation.close(r));
  const controller = new AbortController();
  let log = '';
  const running = run(
    process.execPath,
    [
      path.join(repositoryRoot, 'scripts/cinetic.mjs'),
      args[0],
      '--project',
      p,
      ...args.slice(1),
      `--port=${port}`,
    ],
    {cwd: repositoryRoot, signal: controller.signal, timeoutMs: 60000, onOutput: (s) => (log += s)},
  ).then(
    () => ({ended: true}),
    (e) => ({code: e.code, message: e.message}),
  );
  let ready = false;
  try {
    for (let i = 0; i < 200; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}`);
        if (r.ok && (await r.text()).length > 100) {
          ready = true;
          break;
        }
      } catch {}
      await delay(100);
    }
    assert.equal(ready, true, `${engine} preview did not serve HTML: ${log}`);
  } finally {
    controller.abort();
    const closed = await running;
    assert.equal(closed.code, 'CANCELLED');
  }
  results.push({engine, port, servedHtml: true, ownedTreeCancelled: true});
}
await writeFile(out, JSON.stringify({pass: true, results}, null, 2) + '\n');
console.log(out);
