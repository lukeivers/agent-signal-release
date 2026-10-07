import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
const path = process.argv[2];
if (!path || !isAbsolute(path)) process.exitCode = 1;
else {
  const token = `v1.${Math.floor(Date.now() / 3_600_000)}.${randomBytes(32).toString('base64url')}`;
  await writeFile(path, token, { mode: 0o600, flag: 'wx' });
}
