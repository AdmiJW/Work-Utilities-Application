import { inspectJson } from '../functions/inspect-json';
import { deepDecodeJson } from '../functions/decode-serialized-json';
import { JsonDecodeMode, JsonInspectionView } from '../models/json-inspection';
self.onmessage = (event: MessageEvent<{ source: string; mode: JsonDecodeMode }>) => {
  const view =
    event.data.mode === 'deep'
      ? deepDecodeJson(event.data.source)
      : { source: event.data.source, notice: '' };
  self.postMessage({ ...view, inspection: inspectJson(view.source) } satisfies JsonInspectionView);
};
