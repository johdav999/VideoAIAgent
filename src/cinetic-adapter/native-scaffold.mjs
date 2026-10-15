import {mkdir, cp, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createFilm, validateSettings, filmsRoot, verifyVendor} from './workspace.mjs';
import {abs, vendorRoot, repositoryRoot, copyScripts, writeJson, json} from './native-context.mjs';
export async function hfTimeline(project) {
  const ctx = {};
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ['motion.js', 'timeline.js'])
    vm.runInContext(await readFile(abs(project, f), 'utf8'), ctx, {timeout: 5000, filename: f});
  return {bf: ctx.BF, film: ctx.FILM};
}
export async function scaffold(settings) {
  const spec = validateSettings(settings),
    engine = settings.engine || 'remotion';
  if (!['remotion', 'hyperframes'].includes(engine))
    throw Error('Engine must be remotion or hyperframes');
  let project;
  if (engine === 'remotion') project = await createFilm(spec);
  else {
    const provenance = await verifyVendor();
    await mkdir(filmsRoot, {recursive: true});
    project = path.join(filmsRoot, spec.name);
    await mkdir(project);
    await cp(path.join(vendorRoot, 'release/assets/hyperframes-starter'), project, {
      recursive: true,
    });
    let motion = await readFile(abs(project, 'motion.js'), 'utf8');
    for (const [k, v] of Object.entries({
      W: spec.width,
      H: spec.height,
      FPS: spec.fps,
      BPM: spec.bpm,
    }))
      motion = motion.replace(new RegExp(`const ${k} = [^;]+;`), `const ${k} = ${v};`);
    await writeFile(abs(project, 'motion.js'), motion);
    const {film, bf} = await hfTimeline(project);
    let html = await readFile(abs(project, 'index.html'), 'utf8');
    html = html
      .replaceAll('1920', String(spec.width))
      .replaceAll('1080', String(spec.height))
      .replaceAll('data-fps="60"', `data-fps="${spec.fps}"`)
      .replaceAll('data-duration="5"', `data-duration="${film.TOTAL / bf.FPS}"`);
    await writeFile(abs(project, 'index.html'), html);
    await mkdir(abs(project, 'vendor'), {recursive: true});
    await mkdir(abs(project, 'fonts'), {recursive: true});
    await cp(
      path.join(repositoryRoot, 'node_modules/gsap/dist/gsap.min.js'),
      abs(project, 'vendor/gsap.min.js'),
    );
    await cp(
      path.join(
        repositoryRoot,
        'node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2',
      ),
      abs(project, 'fonts/geist-latin-wght-normal.woff2'),
    );
    await writeJson(abs(project, 'film.json'), {
      ...spec,
      engine,
      template: 'cinetic-hyperframes',
      upstream: provenance.revision,
      shipReady: false,
    });
  }
  await copyScripts(project);
  for (const d of ['out/qa', 'out/stems', 'public/audio'])
    await mkdir(abs(project, d), {recursive: true});
  const specFile = await json(abs(project, 'film.json'));
  specFile.engine = engine;
  if (settings.browser) specFile.browser = path.resolve(settings.browser);
  await writeJson(abs(project, 'film.json'), specFile);
  await cp(path.join(vendorRoot, 'LICENSE'), abs(project, 'CINETIC-LICENSE'));
  await writeFile(
    abs(project, 'scripts/native.mjs'),
    `import {launch} from '../../../../src/cinetic-adapter/native-launch.mjs';\nawait launch(process.argv.slice(2), ${JSON.stringify(project)});\n`,
  );
  const scripts =
    engine === 'remotion'
      ? {
          audio: 'node scripts/native.mjs audio',
          cues: 'node scripts/native.mjs cues',
          lint: 'node scripts/native.mjs lint',
          preview: 'node scripts/native.mjs remotion studio src/index.ts',
          'render:preview': 'node scripts/native.mjs render Film out/preview.mp4 --preview',
          render: 'node scripts/native.mjs render Film out/film.mp4',
          deliver: 'node scripts/native.mjs deliver out/film.mp4',
          'brand-kit': 'node scripts/native.mjs brand-kit',
        }
      : {
          audio: 'node scripts/native.mjs audio',
          cues: 'node scripts/native.mjs cues',
          lint: 'node scripts/native.mjs hyperframes lint',
          check: 'node scripts/native.mjs hyperframes check',
          preview: 'node scripts/native.mjs hyperframes preview',
          snapshot: 'node scripts/native.mjs hyperframes snapshot',
          'render:preview': 'node scripts/native.mjs hf-finish out/preview.mp4 --preview',
          render:
            'node scripts/native.mjs hf-finish out/film.mp4 --audio public/audio/soundtrack.wav',
        };
  await writeJson(abs(project, 'package.json'), {
    name: 'cinetic-windows-film',
    private: true,
    type: 'module',
    scripts,
  });
  await cp(path.join(vendorRoot, 'release/assets/TREATMENT.md'), abs(project, 'TREATMENT.md'));
  if (settings.fonts?.length) {
    const {context} = await import('./native-context.mjs');
    const c = await context(project);
    const npm =
      process.env.npm_execpath ||
      path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
    for (const font of settings.fonts)
      await c.node(abs(project, 'scripts/add-font.mjs'), [font], {
        env: {...c.env, CINETIC_NPM_CLI: npm},
      });
  }
  return project;
}
