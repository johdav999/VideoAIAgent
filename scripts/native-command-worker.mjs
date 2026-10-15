import {spawn} from 'node:child_process';
import {main} from '../src/cinetic-adapter/native-cli.mjs';
// The launcher owns cancellation of this worker and its entire descendant tree.
process.on('SIGINT', () => {});
process.on('SIGTERM', () => {});
const owner = Number(process.env.VIDEO_AGENT_PARENT_PID);
if (owner > 0)
  setInterval(() => {
    try {
      process.kill(owner, 0);
    } catch (e) {
      if (e.code !== 'ESRCH') return;
      if (process.platform === 'win32') {
        const p = spawn('taskkill.exe', ['/PID', String(process.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
        });
        p.on('error', () => process.exit(1));
      } else process.kill(-process.pid, 'SIGKILL');
    }
  }, 1000).unref();
try {
  await main(process.argv.slice(3), process.argv[2]);
} catch (e) {
  console.error(e.stack || e.message);
  process.exitCode = 1;
}
