import { lazy, Suspense } from 'react';
import type { OutputTarget } from './target';

// Loaded only when opened, so the PDF code never weighs down the first load (SPEC.md section 8).
const PdfDialog = lazy(() => import('./PdfDialog'));
const CsvDialog = lazy(() => import('./CsvDialog'));
const ShareDialog = lazy(() => import('./ShareDialog'));

export type OutputKind = 'pdf' | 'csv' | 'share';

/** PDF, CSV or share link for a session or season on screen. */
export function OutputDialog({ kind, target, onClose }: { kind: OutputKind | null; target: OutputTarget; onClose: () => void }) {
  if (!kind) return null;
  return (
    <Suspense fallback={null}>
      {kind === 'pdf' && <PdfDialog target={target} onClose={onClose} />}
      {kind === 'csv' && <CsvDialog target={target} onClose={onClose} />}
      {kind === 'share' && <ShareDialog scope={target.kind} id={target.id} onClose={onClose} />}
    </Suspense>
  );
}
