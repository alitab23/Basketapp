import { lazy, Suspense, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Expand, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Block, Diagram, ImageAttachment } from '../../types/model';
import { db } from '../../db/schema';
import { putImage } from '../../db/repository';
import { newId } from '../../lib/id';
import { CourtView } from '../../drawing/CourtView';
import { copyDiagram, newDiagram } from '../../drawing/elements';
import { isAcceptedImage, processImage } from '../../drawing/images';
import { useImageUrl } from '../../drawing/useImageUrl';
import { Lightbox, type MediaItem } from '../../drawing/Lightbox';
import { ui } from '../ui';
import type { BlockPatch } from './BlockRow';

// The editor itself loads on demand (SPEC.md section 8).
const DiagramEditor = lazy(() => import('../../drawing/DiagramEditor'));

interface Props {
  block: Block;
  onChange: (patch: BlockPatch, coalesceKey: string) => void;
}

/** Drawings ("steps") and photos of a drill (SPEC.md section 5, "Flera bilder per övning"). */
export function DrawingSection({ block, onChange }: Props) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(block.diagrams[0]?.id ?? null);
  const [addOpen, setAddOpen] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const { diagrams, images } = block;
  const active = diagrams.find((d) => d.id === activeId) ?? diagrams[0];
  const activeIndex = active ? diagrams.indexOf(active) : -1;
  const stepName = (i: number) => t('drawing.step', { n: i + 1 });
  const imageName = (i: number) => t('drawing.images.alt', { n: i + 1 });

  const setDiagrams = (next: Diagram[], key: string | null = null) => onChange({ diagrams: next }, key ?? `diagrams:${newId()}`);
  const setImages = (next: ImageAttachment[], key: string | null = null) => onChange({ images: next }, key ?? `images:${newId()}`);

  function insertDiagram(d: Diagram) {
    const at = activeIndex >= 0 ? activeIndex + 1 : diagrams.length;
    setDiagrams([...diagrams.slice(0, at), d, ...diagrams.slice(at)]);
    setActiveId(d.id);
    setAddOpen(false);
  }

  function deleteDiagram(d: Diagram, index: number) {
    if (!window.confirm(t('drawing.confirmDeleteDiagram', { name: stepName(index) }))) return;
    const next = diagrams.filter((x) => x.id !== d.id);
    setDiagrams(next);
    setActiveId(next[Math.max(0, index - 1)]?.id ?? null);
  }

  async function addFiles(files: Iterable<File>) {
    const list = [...files];
    if (list.length === 0) return;
    setError(null);
    setBusy(true);
    const added: ImageAttachment[] = [];
    for (const file of list) {
      if (!isAcceptedImage(file.type)) {
        setError(t('drawing.images.unsupported'));
        continue;
      }
      try {
        const img = await processImage(file, file.type);
        const localBlobId = await putImage(db, img.blob);
        added.push({ id: newId(), fileName: file.name || 'image', mime: img.mime, width: img.width, height: img.height, localBlobId });
      } catch {
        setError(t('drawing.images.failed'));
      }
    }
    setBusy(false);
    if (added.length) setImages([...images, ...added]);
  }

  const media: MediaItem[] = [
    ...diagrams.map((diagram, i) => ({ kind: 'diagram' as const, diagram, name: stepName(i) })),
    ...images.map((image, i) => ({ kind: 'image' as const, image, name: imageName(i) })),
  ];

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const reorder = <T extends { id: string }>(list: T[], e: DragEndEvent): T[] | null => {
    if (!e.over || e.active.id === e.over.id) return null;
    const from = list.findIndex((x) => x.id === e.active.id);
    const to = list.findIndex((x) => x.id === e.over!.id);
    return from < 0 || to < 0 ? null : arrayMove(list, from, to);
  };

  return (
    <div
      className={`space-y-3 rounded-lg ${dragOver ? 'outline-2 outline-dashed outline-orange-500' : ''}`}
      data-testid="drawing-section"
      onDragOver={(e) => {
        if ([...e.dataTransfer.types].includes('Files')) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setDragOver(false);
        void addFiles(e.dataTransfer.files);
      }}
      onPaste={(e) => {
        const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'));
        if (files.length) {
          e.preventDefault();
          void addFiles(files);
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={ui.label}>{t('drawing.title')}</span>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => { const n = reorder(diagrams, e); if (n) setDiagrams(n); }}>
          <SortableContext items={diagrams.map((d) => d.id)} strategy={horizontalListSortingStrategy}>
            <ol className="flex flex-wrap gap-2" data-testid="diagram-thumbs">
              {diagrams.map((d, i) => (
                <Thumb key={d.id} id={d.id} name={stepName(i)} active={d.id === active?.id} onClick={() => setActiveId(d.id)}>
                  <CourtView diagram={d} className="h-14 w-auto" label={stepName(i)} />
                </Thumb>
              ))}
            </ol>
          </SortableContext>
        </DndContext>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => { const n = reorder(images, e); if (n) setImages(n); }}>
          <SortableContext items={images.map((x) => x.id)} strategy={horizontalListSortingStrategy}>
            <ol className="flex flex-wrap gap-2" data-testid="image-thumbs">
              {images.map((img, i) => (
                <Thumb key={img.id} id={img.id} name={imageName(i)} active={false} onClick={() => setViewer(diagrams.length + i)}>
                  <ImageThumb image={img} alt={imageName(i)} />
                </Thumb>
              ))}
            </ol>
          </SortableContext>
        </DndContext>

        <div className="relative">
          <button
            type="button"
            className={ui.secondary}
            aria-expanded={diagrams.length > 0 ? addOpen : undefined}
            onClick={() => (diagrams.length === 0 ? insertDiagram(newDiagram()) : setAddOpen((o) => !o))}
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> {t('drawing.addDiagram')}
          </button>
          {addOpen && (
            <div className="absolute left-0 z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
              <button type="button" className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => insertDiagram(newDiagram(active?.court))}>
                {t('drawing.addEmpty')}
              </button>
              <button type="button" className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => active && insertDiagram(copyDiagram(active))}>
                {t('drawing.addCopy')}
              </button>
            </div>
          )}
        </div>

        <button type="button" className={ui.secondary} onClick={() => fileInput.current?.click()} disabled={busy}>
          <ImagePlus className="h-4 w-4" aria-hidden="true" /> {busy ? t('drawing.images.processing') : t('drawing.images.add')}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          aria-label={t('drawing.images.upload')}
          data-testid="image-input"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = '';
          }}
        />

        {media.length > 0 && (
          <button type="button" className={ui.icon} onClick={() => setViewer(Math.max(0, activeIndex))} aria-label={t('drawing.viewer.open')} title={t('drawing.viewer.open')}>
            <Expand className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {active && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{stepName(activeIndex)}</span>
            <input
              aria-label={t('drawing.caption')}
              placeholder={t('drawing.captionPlaceholder')}
              className={`${ui.input} flex-1`}
              value={active.caption ?? ''}
              onChange={(e) => setDiagrams(diagrams.map((d) => (d.id === active.id ? { ...d, caption: e.target.value || undefined } : d)), `caption:${active.id}`)}
            />
            <button type="button" className={ui.icon} onClick={() => deleteDiagram(active, activeIndex)} aria-label={t('drawing.deleteDiagram')} title={t('drawing.deleteDiagram')}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <Suspense fallback={<div className="aspect-[15.2/16.2] w-full animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />}>
            <DiagramEditor
              key={active.id}
              diagram={active}
              onChange={(next, key) => setDiagrams(diagrams.map((d) => (d.id === next.id ? next : d)), key ?? null)}
              onCopyToNext={() => insertDiagram(copyDiagram(active))}
            />
          </Suspense>
        </div>
      )}

      {images.length > 0 && (
        <ul className="space-y-1">
          {images.map((img, i) => (
            <li key={img.id} className="flex items-center gap-2 text-sm">
              <span className="w-16 shrink-0 text-slate-500">{imageName(i)}</span>
              <input
                aria-label={`${t('drawing.caption')} – ${imageName(i)}`}
                placeholder={t('drawing.caption')}
                className={`${ui.input} flex-1`}
                value={img.caption ?? ''}
                onChange={(e) => setImages(images.map((x) => (x.id === img.id ? { ...x, caption: e.target.value || undefined } : x)), `imgcaption:${img.id}`)}
              />
              <button type="button" className={ui.icon} onClick={() => setImages(images.filter((x) => x.id !== img.id))} aria-label={`${t('drawing.images.delete')} – ${imageName(i)}`}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {viewer !== null && <Lightbox items={media} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />}
    </div>
  );
}

function Thumb({ id, name, active, onClick, children }: { id: string; name: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={isDragging ? 'z-10 opacity-70' : undefined}>
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`${name}. ${t('drawing.moveItem', { name })}`}
        aria-current={active || undefined}
        onClick={onClick}
        data-testid="media-thumb"
        className={`flex flex-col items-center gap-0.5 rounded-md border-2 p-0.5 text-[10px] ${active ? 'border-orange-500' : 'border-transparent hover:border-slate-300'}`}
      >
        {children}
        <span>{name}</span>
      </button>
    </li>
  );
}

function ImageThumb({ image, alt }: { image: ImageAttachment; alt: string }) {
  const url = useImageUrl(image);
  return url ? <img src={url} alt={alt} className="h-14 w-auto rounded object-cover" /> : <span className="block h-14 w-14 rounded bg-slate-200" />;
}
