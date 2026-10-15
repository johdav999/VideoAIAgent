import {open, rename, unlink, readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

export const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
export async function atomicJson(file, value) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  const handle = await open(temporary, 'wx');
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, file);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}
