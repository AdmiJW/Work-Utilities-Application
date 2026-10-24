import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readLicenseKey } from './read-license-key.mjs';

const key = await readLicenseKey();
if (!key) {
  console.error(
    'Set PRIMEUI_LICENSE_KEY in .env.local or the environment before building the image.',
  );
  process.exit(1);
}
process.env.PRIMEUI_LICENSE_KEY = key;
const revision = createHash('sha256').update(key).digest('hex');
const result = spawnSync(
  'docker',
  [
    'build',
    '--secret',
    'id=primeui_license_key,env=PRIMEUI_LICENSE_KEY',
    '--build-arg',
    `BUILD_REVISION=${revision}`,
    '-t',
    'workplace-utilities:local',
    ...process.argv.slice(2),
    '.',
  ],
  { stdio: 'inherit', env: process.env },
);
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
