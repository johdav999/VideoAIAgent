import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {options} from '../src/cinetic-adapter/native-cli.mjs';
import {frameRange, int, abs, json} from '../src/cinetic-adapter/native-context.mjs';
import {scaffold, hfTimeline} from '../src/cinetic-adapter/native-scaffold.mjs';
import {validateReview, dimensions} from '../src/cinetic-adapter/native-review.mjs';
test('native argument arrays preserve paths, reject unknown flags and validate bounded ranges', () => {
  const p = options(
    ['Film', 'out/name ö.mp4', '--blur', '--floor', '20-30:8', '--floor', '40-50:4'],
    'render',
  );
  assert.equal(p.positionals[1], 'out/name ö.mp4');
  assert.deepEqual(p.values.floor, ['20-30:8', '40-50:4']);
  assert.throws(() => options(['--imaginary'], 'render'));
  assert.throws(() => int('Infinity', 1, 4, 'concurrency'));
  for (const s of ['3-2', '-1-3', '0-99', '2;echo']) assert.throws(() => frameRange(s, 20));
  assert.deepEqual(frameRange('2-19', 20), [2, 19]);
});
test('both native starters use repository dependencies and no Bash or symlinks in npm commands', async () => {
  for (const engine of ['remotion', 'hyperframes']) {
    const p = await scaffold({
      name: `Native test ${engine} ${Date.now()}`,
      engine,
      width: 640,
      height: 360,
      fps: 30,
      bpm: 120,
    });
    const pkg = await json(abs(p, 'package.json'));
    for (const cmd of Object.values(pkg.scripts))
      assert.doesNotMatch(cmd, /\bbash\b|\bnpx\b|python3/);
    assert.match(await readFile(abs(p, 'scripts/add-font.mjs'), 'utf8'), /CINETIC_NPM_CLI/);
    assert.doesNotMatch(
      await readFile(abs(p, 'scripts/accumulate.py'), 'utf8'),
      /return \['-framerate', str\(in_fps\), '-pattern_type', 'glob'/,
    );
    if (engine === 'hyperframes') {
      const {bf, film} = await hfTimeline(p);
      assert.equal(bf.FPS, 30);
      assert.equal(film.TOTAL / bf.FPS, 5);
    }
  }
});
test('creative gate refuses missing evidence, low scores and open P0 issues', async () => {
  const p = await scaffold({
    name: `Review test ${Date.now()}`,
    width: 640,
    height: 360,
    fps: 30,
    bpm: 120,
  });
  await writeFile(abs(p, 'out/qa/real-report.json'), '{"pass":true}');
  const r = {
    round: 1,
    scores: Object.fromEntries(dimensions.map((d) => [d, 5])),
    lenses: Object.fromEntries(
      ['director', 'forensics', 'sound-sync', 'art-copy-ui', 'verifier'].map((l) => [
        l,
        {evidence: ['out/qa/real-report.json']},
      ]),
    ),
    issues: [],
    gates: [{pass: true, report: 'out/qa/real-report.json'}],
  };
  assert.equal((await validateReview(p, r)).pass, true);
  assert.equal((await validateReview(p, r)).shipReady, false);
  assert.equal(
    (await validateReview(p, {...r, issues: [{priority: 'P0', status: 'open'}]})).pass,
    false,
  );
  assert.equal((await validateReview(p, {...r, scores: {...r.scores, Finish: 4}})).pass, false);
  assert.equal(
    (await validateReview(p, {...r, gates: [{pass: true, report: '../missing'}]})).pass,
    false,
  );
});
