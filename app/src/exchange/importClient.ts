import type { ParseResult } from './parse';

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (r: ParseResult) => void>();

function getWorker(): Worker | null {
  if (worker || typeof Worker === 'undefined') return worker;
  try {
    worker = new Worker(new URL('./importWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; result: ParseResult }>) => {
      pending.get(e.data.id)?.(e.data.result);
      pending.delete(e.data.id);
    };
  } catch {
    worker = null;
  }
  return worker;
}

/** Parses an import file in a Web Worker, or on the page where workers are not available. */
export async function parseInWorker(text: string, untitled: string): Promise<ParseResult> {
  const w = getWorker();
  if (!w) return (await import('./parse')).parseImport(text, untitled);
  const id = ++seq;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    w.postMessage({ id, text, untitled });
  });
}
