import {ensureBrowser} from '@remotion/renderer';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {repositoryRoot, writeJson} from '../src/cinetic-adapter/workspace.mjs';
import {run} from '../src/renderer/process.mjs';

process.chdir(repositoryRoot);
const browser = await ensureBrowser({browserExecutable: process.env.REMOTION_BROWSER || process.env.CHROMIUM_PATH || null});
if (!('path' in browser)) throw new Error(`Browser unavailable: ${browser.type}`);
const version = (await run(browser.path, ['--version'], {timeoutMs: 15000})).trim();
await mkdir(path.join(repositoryRoot, 'data'), {recursive: true});
await writeJson(path.join(repositoryRoot, 'data/browser.json'), {path: browser.path, version, source: browser.type});
console.log(`Browser ready: ${version}\n${browser.path}`);
