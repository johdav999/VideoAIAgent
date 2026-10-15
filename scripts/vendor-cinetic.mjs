// Import only the reviewed runtime surface from an exact, local upstream checkout.
import {cp, mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'external/cinetic');
const revision = '91c43acf4ea183ea68861d4cd99ec054f6741876';
const actual = execFileSync('git', ['-c', `safe.directory=${source.replaceAll('\\', '/')}`, '-C', source, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
if (actual !== revision) throw new Error(`Expected Cinetic ${revision}, found ${actual}`);
const destination = path.join(root, 'third_party/cinetic');
await mkdir(destination, {recursive: true});
await cp(path.join(source, 'LICENSE'), path.join(destination, 'LICENSE'));
await cp(path.join(source, 'skills/cinetic/assets/remotion-starter'), path.join(destination, 'remotion-starter'), {recursive: true});
const scripts = ['export-cues.ts', 'grid-check.ts', 'lint-film.mjs', 'probe.py', 'check-sync.py', 'sheet.py', 'forensics.py', 'audio/score.py', 'audio/master.py', 'audio/synth.py'];
for (const script of scripts) {
  await mkdir(path.dirname(path.join(destination, 'scripts', script)), {recursive: true});
  await cp(path.join(source, 'skills/cinetic/scripts', script), path.join(destination, 'scripts', script));
}
const files = {};
async function hashes(directory) {
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await hashes(full);
    else if (entry.name !== 'provenance.json') {
      // Git's canonical text uses LF; make hashes independent of checkout autocrlf.
      const text = (await readFile(full, 'utf8')).replaceAll('\r\n', '\n');
      await writeFile(full, text);
      files[path.relative(destination, full).replaceAll('\\', '/')] = createHash('sha256').update(text).digest('hex');
    }
  }
}
await hashes(destination);
await writeFile(path.join(destination, 'provenance.json'), `${JSON.stringify({repository: 'https://github.com/Leonxlnx/cinetic', release: 'v1.0.0', revision, license: 'MIT', modifications: 'None. Windows adaptation is performed in generated workspaces by src/cinetic-adapter.', files}, null, 2)}\n`);
console.log(`Imported ${Object.keys(files).length} original files from Cinetic ${revision}.`);
