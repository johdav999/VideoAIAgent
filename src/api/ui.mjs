import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {repositoryRoot} from '../cinetic-adapter/workspace.mjs';
const assets = new Map([
  ['/', ['src/ui/index.html', 'text/html; charset=utf-8']],
  ['/app.mjs', ['src/ui/app.mjs', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['src/ui/styles.css', 'text/css; charset=utf-8']],
  ['/icon.svg', ['src/ui/icon.svg', 'image/svg+xml']],
  [
    '/assets/geist.woff2',
    ['node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2', 'font/woff2'],
  ],
]);
export async function serveUi(request, response, pathname) {
  if (!['GET', 'HEAD'].includes(request.method) || !assets.has(pathname)) return false;
  const [file, type] = assets.get(pathname),
    bytes = await readFile(path.join(repositoryRoot, file));
  response.setHeader('Content-Type', type);
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  );
  response.writeHead(200, {'Content-Length': bytes.length});
  response.end(request.method === 'HEAD' ? undefined : bytes);
  return true;
}
