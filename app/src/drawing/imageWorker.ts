/// <reference lib="webworker" />
import { resizeImage, type ResizeRequest } from './images';

// Scales and compresses images without blocking the page.
self.onmessage = async (e: MessageEvent<{ id: number; request: ResizeRequest }>) => {
  try {
    const result = await resizeImage(e.data.request);
    self.postMessage({ id: e.data.id, result });
  } catch (err) {
    self.postMessage({ id: e.data.id, error: err instanceof Error ? err.message : String(err) });
  }
};
