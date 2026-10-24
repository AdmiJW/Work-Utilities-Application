import { parseOutputFile } from '../functions/parse-output-file';

self.onmessage = (event: MessageEvent<{ source: string }>) => {
  try {
    const result = parseOutputFile(event.data.source, (progress) =>
      self.postMessage({ type: 'progress', progress }),
    );
    self.postMessage({ type: 'complete', result });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Output analysis failed.',
    });
  }
};
