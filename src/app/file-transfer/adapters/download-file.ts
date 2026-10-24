import { sanitizeFileName } from '../functions/sanitize-file-name';

export function downloadFile(
  content: BlobPart,
  name: string,
  extension: string,
  type: string,
): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = sanitizeFileName(name, extension);
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    throw new Error(
      'Clipboard access is unavailable. Select the raw text and use your browser’s Copy command.',
    );
  }
}
