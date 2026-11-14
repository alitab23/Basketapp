/// <reference lib="webworker" />
import { parseImport } from './parse';

// Parsing and validating large files happens off the main thread (SPEC.md section 8).
self.onmessage = (e: MessageEvent<{ id: number; text: string; untitled: string }>) => {
  self.postMessage({ id: e.data.id, result: parseImport(e.data.text, e.data.untitled) });
};
