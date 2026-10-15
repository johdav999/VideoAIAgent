// Opt-in integration evidence: requires the real local renderer and Python tools.
import assert from 'node:assert/strict';
import path from 'node:path';
import {createFilm, json, writeJson} from '../src/cinetic-adapter/workspace.mjs';
import {renderFilm} from '../src/renderer/render-film.mjs';

const project = await createFilm({name: `Acceptance rörelse ${Date.now()}`, width: 640, height: 360, fps: 30});
const evidence = {project, cases: []};
const record = async (name) => {
  evidence.cases.push({name, status: await json(path.join(project, 'status.json'))});
  await writeJson(path.join(project, 'out/qa/failure-acceptance.json'), evidence);
};
console.log(`Acceptance workspace: ${project}`);

await assert.rejects(renderFilm(project, {env: {...process.env, PYTHON_PATH: path.join(project, 'missing-python.exe')}, onOutput: () => {}}), {code: 'PROCESS_FAILED'});
assert.equal((await json(path.join(project, 'status.json'))).state, 'failed');
await record('missing dependency');

await assert.rejects(renderFilm(project, {env: {...process.env, REMOTION_BROWSER: path.join(project, 'missing-browser.exe')}, onOutput: () => {}}), {code: 'PROCESS_FAILED'});
await record('invalid browser');

const controller = new AbortController();
await assert.rejects(renderFilm(project, {signal: controller.signal, onOutput: (text) => {
  if (text.includes('Picture 0%')) controller.abort();
}}), {code: 'CANCELLED'});
assert.equal((await json(path.join(project, 'status.json'))).state, 'cancelled');
await record('cancel during actual picture render');

await assert.rejects(renderFilm(project, {timeoutSeconds: 1, onOutput: () => {}}), {code: 'TIMEOUT'});
assert.equal((await json(path.join(project, 'status.json'))).state, 'failed');
await record('timeout');

const success = await renderFilm(project, {onOutput: (text) => process.stdout.write(text)});
assert.equal(success.state, 'succeeded');
await record('retry to verified MP4');
console.log(`Failure, cancellation, timeout and retry acceptance passed: ${project}`);
