import {mkdir, open, rename, rmdir, unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {atomicJson, readJson} from '../shared/files.mjs';

function alive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== 'ESRCH';
  }
}
export async function acquireOwner(root) {
  await mkdir(root, {recursive: true});
  const directory = path.join(root, '.owner.lock');
  const owner = {pid: process.pid, token: randomUUID(), startedAt: new Date().toISOString()};
  try {
    await mkdir(directory);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const previous = await readJson(path.join(directory, 'owner.json')).catch(() => null);
    if (!previous || alive(previous.pid))
      throw new Error(`Job store is already owned or its lock is incomplete: ${directory}`);
    // A claim inside the old lock prevents two stale-lock recoverers racing.
    const claim = await open(path.join(directory, 'recovery'), 'wx');
    await claim.close();
    const current = await readJson(path.join(directory, 'owner.json'));
    if (current.token !== previous.token || alive(current.pid)) {
      await unlink(path.join(directory, 'recovery'));
      throw new Error('Job store ownership changed during recovery. Retry startup.');
    }
    await rename(directory, path.join(root, `.stale-owner-${randomUUID()}`));
    await mkdir(directory);
  }
  await atomicJson(path.join(directory, 'owner.json'), owner);
  return async () => {
    const current = await readJson(path.join(directory, 'owner.json'));
    if (current.token !== owner.token) throw new Error('Job store ownership changed.');
    await unlink(path.join(directory, 'owner.json'));
    await rmdir(directory);
  };
}
