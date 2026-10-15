import {appendFile, open, unlink} from 'node:fs/promises';
import path from 'node:path';
import {json, repositoryRoot, resolveProject, writeJson} from '../cinetic-adapter/workspace.mjs';
import {run} from './process.mjs';

export async function renderFilm(
  input,
  {
    mode = 'preview',
    concurrency = 2,
    timeoutSeconds = 600,
    signal,
    env = process.env,
    onEvent = () => {},
    onOutput = (text) => process.stdout.write(text),
  } = {},
) {
  if (!['preview', 'master'].includes(mode))
    throw new Error('Mode must be preview or master. Motion blur is not ported yet.');
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4)
    throw new Error('Concurrency must be 1-4.');
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 3600)
    throw new Error('Timeout must be 1-3600 seconds.');
  const project = await resolveProject(input);
  const lockPath = path.join(project, '.render.lock');
  const lock = await open(lockPath, 'wx');
  const renderLog = path.join(project, 'out/render.log');
  const logs = [];
  let progressBuffer = '';
  try {
    await lock.writeFile(JSON.stringify({pid: process.pid, startedAt: new Date().toISOString()}));
    await appendFile(renderLog, `\n--- ${new Date().toISOString()} ${mode} ---\n`);
    await run(
      process.execPath,
      [
        path.join(repositoryRoot, 'src/renderer/render-worker.mjs'),
        project,
        mode,
        String(concurrency),
      ],
      {
        cwd: project,
        env: {...env, VIDEO_AGENT_PARENT_PID: String(process.pid)},
        signal,
        timeoutMs: timeoutSeconds * 1000,
        onOutput: (text) => {
          logs.push(text);
          onOutput(text);
          progressBuffer += text;
          const lines = progressBuffer.split('\n');
          progressBuffer = lines.pop();
          for (const line of lines)
            if (line.startsWith('@video-progress ')) onEvent(JSON.parse(line.slice(16)));
        },
      },
    );
    const status = await json(path.join(project, 'status.json'));
    if (status.state !== 'succeeded') throw new Error('Worker exited without verified success.');
    return status;
  } catch (error) {
    await writeJson(path.join(project, 'status.json'), {
      state: error.code === 'CANCELLED' ? 'cancelled' : 'failed',
      code: error.code ?? 'RENDER_FAILED',
      message: error.message,
      updatedAt: new Date().toISOString(),
    });
    throw error;
  } finally {
    try {
      await appendFile(renderLog, logs.join(''));
    } finally {
      await lock.close();
      await unlink(lockPath);
    }
  }
}
