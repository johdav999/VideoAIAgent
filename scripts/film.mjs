import {parseArgs} from 'node:util';
import {createFilm, resolveProject} from '../src/cinetic-adapter/workspace.mjs';
import {renderFilm} from '../src/renderer/render-film.mjs';

const {values, positionals} = parseArgs({allowPositionals: true, options: {
  name: {type: 'string'}, project: {type: 'string'}, width: {type: 'string'}, height: {type: 'string'}, fps: {type: 'string'}, bpm: {type: 'string'}, mode: {type: 'string', default: 'preview'}, concurrency: {type: 'string', default: '2'}, 'timeout-seconds': {type: 'string', default: '600'}, help: {type: 'boolean'},
}});
const command = positionals[0];
if (values.help || !command) {
  console.log('film.mjs new --name "Windows rörelse" [--width 1280 --height 720 --fps 60 --bpm 120]\nfilm.mjs render --project "data/films/Windows rörelse" [--mode preview|master --concurrency 2 --timeout-seconds 600]\nfilm.mjs sample [--name "Windows rörelse timestamp"]');
} else {
  try {
    if (!['new', 'render', 'sample'].includes(command) || positionals.length !== 1) throw new Error('Use new, render or sample; see --help.');
    const concurrency = Number(values.concurrency);
    const timeout = Number(values['timeout-seconds']);
    if (!['preview', 'master'].includes(values.mode)) throw new Error('Mode must be preview or master. Use npm.cmd run cinetic for blur.');
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) throw new Error('Concurrency must be 1-4.');
    if (!Number.isInteger(timeout) || timeout < 1 || timeout > 3600) throw new Error('Timeout must be 1-3600 seconds.');
    let project;
    if (command === 'render') {
      if (!values.project) throw new Error('--project is required.');
      project = await resolveProject(values.project);
    } else {
      project = await createFilm({name: values.name ?? (command === 'sample' ? `Windows rörelse ${Date.now()}` : undefined), ...Object.fromEntries(['width', 'height', 'fps', 'bpm'].filter((key) => values[key] !== undefined).map((key) => [key, Number(values[key])]))});
      console.log(`Created film: ${project}`);
    }
    if (command !== 'new') {
      const controller = new AbortController();
      const cancel = () => controller.abort();
      process.once('SIGINT', cancel);
      process.once('SIGTERM', cancel);
      try {
        const status = await renderFilm(project, {mode: values.mode, concurrency, timeoutSeconds: timeout, signal: controller.signal});
        console.log(`Verified video: ${status.output}`);
      } finally {
        process.removeListener('SIGINT', cancel);
        process.removeListener('SIGTERM', cancel);
      }
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
