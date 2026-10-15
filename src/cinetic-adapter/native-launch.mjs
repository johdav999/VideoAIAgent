import path from 'node:path';
import {repositoryRoot} from './workspace.mjs';
import {run} from '../renderer/process.mjs';
import {open, unlink, readFile} from 'node:fs/promises';
import {resolveProject, writeJson} from './workspace.mjs';
export async function launch(args, project = process.cwd()) {
  const pi = args.indexOf('--project');
  if (pi >= 0) project = args[pi + 1];
  const guarded = new Set([
    'render',
    'render-chunks',
    'hf-finish',
    'audio',
    'deliver',
    'brand-kit',
    'layout-audit',
    'add-font',
    'dither-gradient',
  ]);
  let lock, lockPath, status;
  if (guarded.has(args[0]) && !args.includes('--help') && !args.includes('-h')) {
    project = await resolveProject(project);
    lockPath = path.join(project, '.render.lock');
    status = path.join(project, 'native-status.json');
    try {
      lock = await open(lockPath, 'wx');
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const owner = JSON.parse(await readFile(lockPath, 'utf8'));
      throw Error(
        `Film is locked by PID ${owner.pid}: ${project}. Inspect the owner before removing a stale lock.`,
      );
    }
    await lock.writeFile(
      JSON.stringify({pid: process.pid, startedAt: new Date().toISOString(), native: true}),
    );
  }
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  try {
    if (status)
      await writeJson(status, {
        state: 'running',
        command: args[0],
        startedAt: new Date().toISOString(),
      });
    await run(
      process.execPath,
      [path.join(repositoryRoot, 'scripts/native-command-worker.mjs'), project, ...args],
      {
        cwd: repositoryRoot,
        env: {...process.env, VIDEO_AGENT_PARENT_PID: String(process.pid)},
        signal: controller.signal,
        timeoutMs: 3600000,
        onOutput: (s) => process.stdout.write(s),
      },
    );
    if (status)
      await writeJson(status, {
        state: 'succeeded',
        command: args[0],
        endedAt: new Date().toISOString(),
      });
  } catch (e) {
    if (status)
      await writeJson(status, {
        state: e.code === 'CANCELLED' ? 'cancelled' : 'failed',
        command: args[0],
        error: e.message,
        endedAt: new Date().toISOString(),
      });
    throw e;
  } finally {
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
    if (lock) {
      await lock.close();
      await unlink(lockPath);
    }
  }
}
