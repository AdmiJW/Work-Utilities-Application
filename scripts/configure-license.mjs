import { mkdir, writeFile } from 'node:fs/promises';
import { readLicenseKey } from './read-license-key.mjs';

await mkdir(new URL('../src/generated/', import.meta.url), { recursive: true });
const licenseKey = await readLicenseKey();
await writeFile(
  new URL('../src/generated/primeui-license.ts', import.meta.url),
  `// Generated locally. Do not commit.\nexport const primeuiLicenseKey = ${JSON.stringify(licenseKey)};\n`,
);
