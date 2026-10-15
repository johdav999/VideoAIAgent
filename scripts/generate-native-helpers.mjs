// Extract unchanged algorithms from the pinned shell entrypoints; execute them without a shell.
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {repositoryRoot, vendorRoot} from '../src/cinetic-adapter/workspace.mjs';
const dest = path.join(repositoryRoot, 'src/cinetic-adapter/helpers');
await mkdir(dest, {recursive: true});
for (const [source, names] of Object.entries({
  'layout-audit.sh': ['layout-report.cjs'],
  'brand-kit.sh': ['crop-lockups.py'],
  'deliver.sh': [
    'media-meta.py',
    'poster-match.py',
    'loop-seam.py',
    'alpha-check.py',
    'delivery-manifest.py',
  ],
})) {
  const text = await readFile(path.join(vendorRoot, 'release/scripts', source), 'utf8');
  const blocks = [...text.matchAll(/<<'(PY|EOF)'[^\n]*\n([\s\S]*?)\n\1(?:\n|$)/g)].map((m) => m[2]);
  if (blocks.length !== names.length)
    throw Error(`${source}: expected ${names.length} blocks, got ${blocks.length}`);
  for (let i = 0; i < names.length; i++)
    await writeFile(
      path.join(dest, names[i]),
      `#PLACEHOLDER\n${blocks[i]}\n`.replace(
        '#PLACEHOLDER',
        names[i].endsWith('.py')
          ? `# Unchanged algorithm from Cinetic v1.0.0 ${source}, MIT; see third_party/cinetic/provenance.json.`
          : `// Unchanged algorithm from Cinetic v1.0.0 ${source}, MIT; see third_party/cinetic/provenance.json.`,
      ),
    );
}
