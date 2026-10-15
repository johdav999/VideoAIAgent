// Publish only measured metadata, not generated media, into the tracked acceptance record.
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {repositoryRoot, json} from '../src/cinetic-adapter/workspace.mjs';
const dir = path.resolve(process.argv[2]);
const result = await json(path.join(dir, 'results.json'));
assert.equal(result.platform, 'win32');
assert.equal(result.complete, true);
assert.equal(result.pass, true);
assert.ok(result.results.every((r) => r.pass));
const relative = (p) => path.relative(repositoryRoot, p).replaceAll('\\', '/');
const artifacts = result.artifacts.map((a) => {
  const v = a.ffprobe?.streams.find((s) => s.codec_type === 'video');
  return {
    file: relative(a.file),
    bytes: a.bytes,
    sha256: a.sha256,
    ...(v
      ? {
          codec: v.codec_name,
          width: v.width,
          height: v.height,
          fps: v.avg_frame_rate,
          frames: Number(v.nb_read_packets),
          pixelFormat: v.pix_fmt,
          color: {
            space: v.color_space,
            primaries: v.color_primaries,
            transfer: v.color_transfer,
            range: v.color_range,
          },
          audio: a.ffprobe.streams
            .filter((s) => s.codec_type === 'audio')
            .map((s) => ({codec: s.codec_name, sampleRate: s.sample_rate, channels: s.channels})),
        }
      : {}),
  };
});
const snapshot = {
  date: '2026-10-15',
  upstream: result.upstream,
  platform: result.platform,
  node: result.node,
  evidence: relative(dir),
  project: relative(result.project),
  hyperframesProject: relative(result.hf),
  cases: result.results,
  artifacts,
  previews: await json(path.join(dir, 'previews.json')),
  alpha: await json(path.join(dir, 'alpha.json')),
  pass: true,
  shipReady: false,
};
await writeFile(
  path.join(repositoryRoot, 'docs/acceptance/windows-cinetic-summary.json'),
  JSON.stringify(snapshot, null, 2) + '\n',
);
console.log(`Recorded ${result.results.length} measured cases and ${artifacts.length} artifacts.`);
