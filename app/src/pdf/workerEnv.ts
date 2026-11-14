/// <reference lib="webworker" />
// Development only: Vite's React refresh code, which is added to .tsx files in
// `npm run dev`, expects `window`. A worker has none; the built app does not need this.
if (import.meta.env.DEV && typeof window === 'undefined') {
  (globalThis as unknown as { window: typeof globalThis }).window = globalThis;
}
export {};
