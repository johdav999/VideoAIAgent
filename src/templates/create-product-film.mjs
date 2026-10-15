import {cp, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {
  filmsRoot,
  repositoryRoot,
  vendorRoot,
  verifyVendor,
  writeJson,
} from '../cinetic-adapter/workspace.mjs';
import {validateSpecification} from '../jobs/specification.mjs';
import {copyScripts} from '../cinetic-adapter/native-context.mjs';

export async function createProductFilm(input, name) {
  const spec = validateSpecification(input);
  if (!/^job-[a-f\d-]+-\d+$/.test(name)) throw new Error('Invalid job workspace name.');
  const provenance = await verifyVendor();
  await mkdir(filmsRoot, {recursive: true});
  const project = path.join(filmsRoot, name);
  await mkdir(project);
  await cp(path.join(repositoryRoot, 'src/templates/product-launch'), path.join(project, 'src'), {
    recursive: true,
  });
  await cp(path.join(vendorRoot, 'scripts'), path.join(project, 'scripts'), {recursive: true});
  await copyScripts(project);
  await cp(path.join(vendorRoot, 'LICENSE'), path.join(project, 'CINETIC-LICENSE'));
  for (const directory of ['audio', 'public/audio', 'out/qa', 'out/stems'])
    await mkdir(path.join(project, directory), {recursive: true});
  await writeJson(path.join(project, 'src/spec.json'), spec);
  await writeJson(path.join(project, 'package.json'), {
    name: 'video-agent-product-film',
    private: true,
    type: 'module',
  });
  await writeJson(path.join(project, 'film.json'), {
    schemaVersion: 1,
    name,
    width: spec.width,
    height: spec.height,
    fps: spec.fps,
    bpm: 120,
    upstream: provenance.revision,
    template: 'product-launch',
    entry: 'src/index.tsx',
    shipReady: false,
  });
  const bars = Math.ceil(spec.durationSeconds / 2);
  await writeJson(path.join(project, 'audio/score.json'), {
    key: 'G major',
    bpm: 120,
    chords: Array.from({length: bars}, (_, i) => ['Em9', 'Cmaj9', 'Am11 D7sus4', 'Gadd9'][i % 4]),
    sections: [
      {bars: [1, 1], style: 'intro'},
      {bars: [2, Math.max(2, bars - 2)], style: 'build'},
      {bars: [Math.max(3, bars - 1), bars], style: 'resolve'},
    ],
    signature: {tick: 'G7', tock: 'D7', motif: [0, 7, 14], rhythm: [0, 0.5, 1.5]},
    mix: {music: 0.55, sfx: 1, reverb: 1, sidechain: 0.55, duck_db: 3},
    master: {lufs: -14, ceiling: 0.77, fade: 1},
  });
  await writeFile(
    path.join(project, 'TREATMENT.md'),
    `# ${spec.brand.name}\n\nIdea: ${spec.title}\n\nMessage: ${spec.message}\n\nAction: ${spec.callToAction}\n\nThree acts share the request palette, local Geist type, a visible timeline and a continuously advancing final beat. Duration ${spec.durationSeconds}s. User-supplied palette/logo are retained.\n`,
  );
  await writeJson(path.join(project, 'status.json'), {
    state: 'created',
    updatedAt: new Date().toISOString(),
  });
  return project;
}
