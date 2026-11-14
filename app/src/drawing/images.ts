import type { ImageAttachment } from '../types/model';

/** SPEC.md section 5: photos are scaled down to at most 1600 px and compressed. */
export const MAX_IMAGE_SIZE = 1600;
export const JPEG_QUALITY = 0.85;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AcceptedType = (typeof ACCEPTED_TYPES)[number];

export const isAcceptedImage = (type: string): type is AcceptedType => (ACCEPTED_TYPES as readonly string[]).includes(type);

/** New size that fits within `max` on the longest side, keeping the aspect ratio. Never scales up. */
export function fitWithin(width: number, height: number, max = MAX_IMAGE_SIZE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const k = max / longest;
  return { width: Math.round(width * k), height: Math.round(height * k) };
}

/** PNG stays PNG (sketches, transparency); photos become JPEG. */
export function outputType(input: AcceptedType): 'image/png' | 'image/jpeg' {
  return input === 'image/png' ? 'image/png' : 'image/jpeg';
}

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
  mime: ImageAttachment['mime'];
}

export interface ResizeRequest {
  file: Blob;
  type: AcceptedType;
}

/** The actual work; runs in a Web Worker when possible (OffscreenCanvas), otherwise on the page. */
export async function resizeImage({ file, type }: ResizeRequest): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(file);
  const size = fitWithin(bitmap.width, bitmap.height);
  const mime = outputType(type);
  let blob: Blob;
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(size.width, size.height);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, size.width, size.height);
    blob = await canvas.convertToBlob({ type: mime, quality: JPEG_QUALITY });
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, size.width, size.height);
    blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), mime, JPEG_QUALITY),
    );
  }
  bitmap.close();
  return { blob, ...size, mime };
}

let worker: Worker | null = null;
let nextJob = 0;
const jobs = new Map<number, { resolve: (r: ProcessedImage) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (worker || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return worker;
  try {
    worker = new Worker(new URL('./imageWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; result?: ProcessedImage; error?: string }>) => {
      const job = jobs.get(e.data.id);
      jobs.delete(e.data.id);
      if (!job) return;
      if (e.data.result) job.resolve(e.data.result);
      else job.reject(new Error(e.data.error ?? 'failed'));
    };
  } catch {
    worker = null;
  }
  return worker;
}

/** Scales and compresses an uploaded image off the main thread (SPEC.md section 8). */
export function processImage(file: Blob, type: AcceptedType): Promise<ProcessedImage> {
  const w = getWorker();
  if (!w) return resizeImage({ file, type });
  const id = ++nextJob;
  return new Promise((resolve, reject) => {
    jobs.set(id, { resolve, reject });
    w.postMessage({ id, request: { file, type } });
  });
}
