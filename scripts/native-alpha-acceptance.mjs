import assert from 'node:assert/strict';
import sharp from 'sharp';
import {context, abs, writeJson} from '../src/cinetic-adapter/native-context.mjs';
const [project, out] = process.argv.slice(2);
const c = await context(project);
const checks = [];
for (const [name, decoder] of [
  ['Alpha.mov', []],
  ['Alpha-alpha.webm', ['-c:v', 'libvpx-vp9']],
]) {
  const png = abs(project, `out/deliver/qa/${name}.png`);
  await c.execute('ffmpeg', [
    '-v',
    'error',
    '-y',
    ...decoder,
    '-i',
    abs(project, `out/deliver/${name}`),
    '-frames:v',
    '1',
    png,
  ]);
  const {data, info} = await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  let clear = 0,
    opaque = 0;
  for (let i = 3; i < data.length; i += info.channels) {
    if (data[i] === 0) clear++;
    if (data[i] === 255) opaque++;
  }
  const pixels = info.width * info.height;
  assert.ok(clear / pixels > 0.5, `${name}: missing transparent background`);
  assert.ok(opaque / pixels > 0.01, `${name}: missing opaque artwork`);
  checks.push({file: name, clearRatio: clear / pixels, opaqueRatio: opaque / pixels, pass: true});
}
await writeJson(out, {pass: true, checks});
console.log(out);
