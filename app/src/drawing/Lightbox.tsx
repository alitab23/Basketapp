import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Diagram, ImageAttachment } from '../types/model';
import { CourtView } from './CourtView';
import { useImageUrl } from './useImageUrl';

export type MediaItem = { kind: 'diagram'; diagram: Diagram; name: string } | { kind: 'image'; image: ImageAttachment; name: string };

function ImageLarge({ image, alt }: { image: ImageAttachment; alt: string }) {
  const url = useImageUrl(image);
  return url ? <img src={url} alt={alt} className="max-h-[75vh] max-w-full object-contain" /> : null;
}

/** Shows one drawing or photo large; arrows browse (SPEC.md section 5). */
export function Lightbox({ items, index, onIndex, onClose }: { items: MediaItem[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const closeRef = useRef<HTMLButtonElement>(null);
  const item = items[index];
  const go = (d: number) => onIndex((index + d + items.length) % items.length);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  if (!item) return null;
  const caption = item.kind === 'diagram' ? item.diagram.caption : item.image.caption;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
      data-testid="lightbox"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-slate-950/85 p-4"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'ArrowRight') go(1);
        if (e.key === 'ArrowLeft') go(-1);
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <button ref={closeRef} type="button" onClick={onClose} aria-label={t('drawing.viewer.close')} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
      <div className="flex w-full max-w-5xl items-center justify-center gap-2">
        {items.length > 1 && (
          <button type="button" onClick={() => go(-1)} aria-label={t('drawing.viewer.previous')} className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </button>
        )}
        <div className="flex min-w-0 flex-1 justify-center rounded-lg bg-white p-2">
          {item.kind === 'diagram' ? <CourtView diagram={item.diagram} className="max-h-[75vh] w-full" label={item.name} /> : <ImageLarge image={item.image} alt={item.name} />}
        </div>
        {items.length > 1 && (
          <button type="button" onClick={() => go(1)} aria-label={t('drawing.viewer.next')} className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
            <ChevronRight className="h-6 w-6" aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="text-sm text-white">
        <span className="font-medium">{item.name}</span>
        {caption ? ` – ${caption}` : ''} <span className="text-white/60">({t('drawing.viewer.position', { n: index + 1, total: items.length })})</span>
      </p>
    </div>
  );
}
