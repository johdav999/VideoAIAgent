import {readdir} from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {repositoryRoot, verifyVendor, json} from '../src/cinetic-adapter/workspace.mjs';

async function check(directory) {
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await check(file);
    else if (entry.name.endsWith('.mjs')) execFileSync(process.execPath, ['--check', file], {stdio: 'inherit'});
  }
}
for (const directory of ['src', 'scripts', 'tests']) await check(path.join(repositoryRoot, directory));
await verifyVendor();
const manifest = await json(path.join(repositoryRoot, 'package.json'));
const versions = Object.entries(manifest.dependencies).filter(([name]) => name === 'remotion' || name.startsWith('@remotion/')).map(([, version]) => version);
if (new Set(versions).size !== 1 || !/^4\.\d+\.\d+$/.test(versions[0])) throw new Error('All Remotion packages must use one exact 4.x version.');
console.log('Syntax, vendored source hashes and matching Remotion versions passed.');
