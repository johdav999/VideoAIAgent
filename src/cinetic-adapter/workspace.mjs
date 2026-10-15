import {mkdir, readFile, writeFile, cp, realpath, lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
export const filmsRoot = path.join(repositoryRoot, 'data/films');
export const vendorRoot = path.join(repositoryRoot, 'third_party/cinetic');
export const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
export const writeJson = (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`);

export function validateSettings({name, width = 1280, height = 720, fps = 60, bpm = 120}) {
  if (typeof name !== 'string' || !/^[\p{L}\p{N}][\p{L}\p{N} _-]{0,79}$/u.test(name) || /[ .]$/.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name)) {
    throw new Error('Name must be 1-80 letters, numbers, spaces, underscores or hyphens, without reserved Windows names.');
  }
  for (const [key, value, min, max] of [['width', width, 320, 3840], ['height', height, 180, 2160], ['fps', fps, 24, 60], ['bpm', bpm, 60, 180]]) {
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${key} must be an integer from ${min} to ${max}.`);
  }
  if (width % 2 || height % 2 || width * height > 3840 * 2160) throw new Error('Dimensions must be even and at most 3840x2160 pixels.');
  if (!Number.isInteger(60 * fps / bpm)) throw new Error('BPM must give a whole number of frames per beat.');
  return {name, width, height, fps, bpm};
}

export async function verifyVendor() {
  const provenance = await json(path.join(vendorRoot, 'provenance.json'));
  for (const [file, expected] of Object.entries(provenance.files)) {
    const actual = createHash('sha256').update(await readFile(path.join(vendorRoot, file))).digest('hex');
    if (actual !== expected) throw new Error(`Vendored Cinetic file changed: ${file}`);
  }
  return provenance;
}

export async function resolveProject(input) {
  const project = await realpath(path.resolve(input));
  const base = await realpath(filmsRoot);
  if (path.dirname(project) !== base || (await lstat(project)).isSymbolicLink()) throw new Error('Project must be a direct directory under this repository\'s data/films.');
  return project;
}

export async function createFilm(settings) {
  const spec = validateSettings(settings);
  const provenance = await verifyVendor();
  await mkdir(filmsRoot, {recursive: true});
  // Exclusive creation is intentional: a retry never overwrites an existing film.
  const project = path.join(filmsRoot, spec.name);
  await mkdir(project);
  await cp(path.join(vendorRoot, 'remotion-starter/src'), path.join(project, 'src'), {recursive: true});
  await cp(path.join(vendorRoot, 'remotion-starter/audio'), path.join(project, 'audio'), {recursive: true});
  await cp(path.join(vendorRoot, 'scripts'), path.join(project, 'scripts'), {recursive: true});
  await cp(path.join(vendorRoot, 'LICENSE'), path.join(project, 'CINETIC-LICENSE'));
  for (const directory of ['public/audio', 'out/qa', 'out/stems']) await mkdir(path.join(project, directory), {recursive: true});
  const timelineFile = path.join(project, 'src/timeline.ts');
  let timeline = await readFile(timelineFile, 'utf8');
  for (const [key, value] of Object.entries({W: spec.width, H: spec.height, FPS: spec.fps, BPM: spec.bpm})) {
    const pattern = new RegExp(`export const ${key} = [^;]+;`);
    if (!pattern.test(timeline)) throw new Error(`Upstream timeline no longer defines ${key}.`);
    timeline = timeline.replace(pattern, `export const ${key} = ${value};`);
  }
  await writeFile(timelineFile, timeline);
  await writeJson(path.join(project, 'package.json'), {name: 'cinetic-windows-film', private: true, type: 'module'});
  await writeJson(path.join(project, 'film.json'), {schemaVersion: 1, ...spec, upstream: provenance.revision, template: 'cinetic-starter', shipReady: false});
  await writeJson(path.join(project, 'status.json'), {state: 'created', updatedAt: new Date().toISOString()});
  await writeFile(path.join(project, 'TREATMENT.md'), '# Windows compatibility demonstration\n\nThis renders the pinned Cinetic starter, including its placeholder brand and copy. It tests native Windows tooling, timing and audio. It is not a finished customer film.\n');
  return project;
}
