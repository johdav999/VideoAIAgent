import assert from 'node:assert/strict';
import test from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {run} from '../src/renderer/process.mjs';

test('reports missing executables and renderer failures without success', async () => {
  await assert.rejects(run('video-ai-agent-nonexistent-executable', []), {code: 'START_FAILED'});
  await assert.rejects(run(process.execPath, ['-e', 'console.error("intentional renderer failure"); process.exit(7)']), (error) => error.code === 'PROCESS_FAILED' && /intentional renderer failure/.test(error.message));
  assert.match(await run(process.execPath, ['-e', 'console.log("retry succeeded")']), /retry succeeded/);
});

test('timeout kills the owned process', async () => {
  await assert.rejects(run(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {timeoutMs: 100}), {code: 'TIMEOUT'});
});

test('cancellation kills the owned worker and its descendant', {timeout: 15000}, async () => {
  const controller = new AbortController();
  let descendant;
  const source = 'const {spawn}=require("node:child_process"); const child=spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore"}); console.log(child.pid); setInterval(()=>{},1000);';
  await assert.rejects(run(process.execPath, ['-e', source], {signal: controller.signal, onOutput: (text) => {
    const pid = Number(text.trim());
    if (Number.isInteger(pid) && pid > 0) { descendant = pid; controller.abort(); }
  }}), {code: 'CANCELLED'});
  assert.ok(descendant);
  for (let attempt = 0; attempt < 20; attempt++) {
    try { process.kill(descendant, 0); } catch { return; }
    await delay(100);
  }
  assert.fail(`Descendant ${descendant} survived cancellation`);
});
