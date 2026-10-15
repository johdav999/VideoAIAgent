// HyperFrames 0.8.79 has no cache/config-root option. Scope its home-based state to
// this worker's repository directory without changing the user's environment/profile.
import os from 'node:os';
import {syncBuiltinESMExports} from 'node:module';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {repositoryRoot} from './workspace.mjs';
const directory = process.env.CINETIC_RUNTIME_HOME;
if (!directory) throw Error('Missing repository-scoped HyperFrames runtime directory');
const rel = path.relative(repositoryRoot, path.resolve(directory));
if (!rel || rel.startsWith('..') || path.isAbsolute(rel))
  throw Error('HyperFrames runtime must remain in this repository');
mkdirSync(directory, {recursive: true});
os.homedir = () => directory;
syncBuiltinESMExports();
