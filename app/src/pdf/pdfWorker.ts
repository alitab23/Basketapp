/// <reference lib="webworker" />
import './workerEnv'; // must come first
import { renderPdf } from './render';
import type { PdfDocumentModel } from './model';

// Building the PDF is the heaviest job in the app; it runs off the main thread (SPEC.md section 8).
self.onmessage = async (e: MessageEvent<{ id: number; model: PdfDocumentModel }>) => {
  try {
    const blob = await renderPdf(e.data.model);
    self.postMessage({ id: e.data.id, blob });
  } catch (err) {
    self.postMessage({ id: e.data.id, error: String(err) });
  }
};
