import { readFile } from 'node:fs/promises';

export async function readLicenseKey() {
  if (process.env.PRIMEUI_LICENSE_KEY) return process.env.PRIMEUI_LICENSE_KEY;
  if (process.env.PRIMEUI_LICENSE_KEY_FILE)
    return (await readFile(process.env.PRIMEUI_LICENSE_KEY_FILE, 'utf8')).trim();
  return '';
}
