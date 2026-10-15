import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {createFilm, filmsRoot, json, validateSettings, verifyVendor} from '../src/cinetic-adapter/workspace.mjs';

test('rejects traversal, Windows reserved names and invalid render grids', () => {
  for (const name of ['../escape', 'a/b', 'a\\b', 'CON', 'nul', 'LPT1', 'trailing ', 'a;echo']) assert.throws(() => validateSettings({name}));
  assert.throws(() => validateSettings({name: 'valid', width: 1279}));
  assert.throws(() => validateSettings({name: 'valid', fps: 120}));
  assert.throws(() => validateSettings({name: 'valid', bpm: 110}));
  assert.throws(() => validateSettings({name: 'valid', width: Infinity}));
});

test('pinned upstream hashes match the original source', async () => {
  const provenance = await verifyVendor();
  assert.equal(provenance.revision, '91c43acf4ea183ea68861d4cd99ec054f6741876');
  assert.ok(Object.keys(provenance.files).length > 30);
});

test('scaffolds spaces/Unicode without symlinks or overwriting an existing film', async (t) => {
  const name = `Test rörelse ${process.pid}-${Date.now()}`;
  const project = await createFilm({name, width: 640, height: 360, fps: 30, bpm: 120});
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(project)), path.resolve(filmsRoot));
    await rm(project, {recursive: true, force: true});
  });
  const timeline = await readFile(path.join(project, 'src/timeline.ts'), 'utf8');
  assert.match(timeline, /export const W = 640;/);
  assert.match(timeline, /export const FPS = 30;/);
  assert.equal((await json(path.join(project, 'film.json'))).shipReady, false);
  assert.equal((await json(path.join(project, 'status.json'))).state, 'created');
  await assert.rejects(createFilm({name}), {code: 'EEXIST'});
  assert.equal(await readFile(path.join(project, 'src/timeline.ts'), 'utf8'), timeline);
});
