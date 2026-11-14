import type { PdfDocumentModel } from './model';

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (b: Blob) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./pdfWorker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<{ id: number; blob?: Blob; error?: string }>) => {
    const p = pending.get(e.data.id);
    pending.delete(e.data.id);
    if (!p) return;
    if (e.data.blob) p.resolve(e.data.blob);
    else p.reject(new Error(e.data.error ?? 'pdf'));
  };
  worker.onerror = (e) => {
    // The worker could not load or crashed: fail every waiting job instead of hanging.
    for (const p of pending.values()) p.reject(new Error(e.message || 'worker'));
    pending.clear();
    worker = null;
  };
  return worker;
}

/**
 * Makes the PDF in a Web Worker (all browsers the app supports have module
 * workers). There is no fallback on the page: it would put a second copy of
 * the 450 KB PDF library in the offline cache.
 */
export async function makePdf(model: PdfDocumentModel): Promise<Blob> {
  const w = getWorker();
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, model });
  });
}
