import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Trash2 } from 'lucide-react';
import type { CourtElement } from '../types/model';
import { DEFAULT_COLOR, isLine, LINE_TYPES, type LineElement } from './elements';
import { ui } from '../components/ui';

export const SWATCHES = ['#111827', '#1d4ed8', '#dc2626', '#16a34a', '#f97316', '#7c3aed', '#f59e0b', '#ffffff'];

interface Props {
  selected: CourtElement[];
  all: CourtElement[];
  onPatch: (id: string, patch: Partial<CourtElement>, coalesceKey: string) => void;
  onPatchAll: (patch: Partial<CourtElement>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

const hasColor = (e: CourtElement) => e.type !== 'text';

/** Colour, number, text and shape of the selected objects (SPEC.md section 5, "Redigering"). */
export function PropertiesPanel({ selected, all, onPatch, onPatchAll, onDelete, onDuplicate }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const one = selected.length === 1 ? selected[0]! : null;

  if (selected.length === 0) {
    return <p className="text-xs text-slate-500 dark:text-slate-400">{t('drawing.props.none')}</p>;
  }

  const colored = selected.filter(hasColor);
  const currentColor = one && hasColor(one) ? (('color' in one && one.color) || DEFAULT_COLOR[one.type]) : undefined;

  return (
    <div className="space-y-3 text-sm" data-testid="properties">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('drawing.props.count', { count: selected.length })}</p>

      {colored.length > 0 && (
        <fieldset>
          <legend className={ui.label}>{t('drawing.props.color')}</legend>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={currentColor?.toLowerCase() === c}
                onClick={() => onPatchAll({ color: c } as Partial<CourtElement>)}
                className="h-6 w-6 rounded-full border border-slate-300 aria-pressed:ring-2 aria-pressed:ring-orange-500 aria-pressed:ring-offset-1"
                style={{ background: c }}
              />
            ))}
            <input
              type="color"
              aria-label={t('drawing.props.color')}
              value={currentColor ?? '#111827'}
              onChange={(e) => onPatchAll({ color: e.target.value } as Partial<CourtElement>)}
              className="h-6 w-8 cursor-pointer rounded border border-slate-300 bg-transparent"
            />
          </div>
        </fieldset>
      )}

      {one && (one.type === 'offense' || one.type === 'defense' || one.type === 'coach') && (
        <div>
          <label className={ui.label} htmlFor={`${id}-label`}>
            {t('drawing.props.label')}
          </label>
          <input
            id={`${id}-label`}
            className={ui.input}
            maxLength={3}
            value={one.label ?? ''}
            onChange={(e) => onPatch(one.id, { label: e.target.value }, `label:${one.id}`)}
          />
        </div>
      )}

      {one && (one.type === 'offense' || one.type === 'defense' || one.type === 'coach' || one.type === 'cone') && (
        <div>
          <label className={ui.label} htmlFor={`${id}-rotation`}>
            {t('drawing.props.rotation')}
          </label>
          <input
            id={`${id}-rotation`}
            type="range"
            min={0}
            max={359}
            step={15}
            className="w-full accent-orange-500"
            value={one.rotation ?? 0}
            onChange={(e) => onPatch(one.id, { rotation: Number(e.target.value) || undefined }, `rotation:${one.id}`)}
          />
        </div>
      )}

      {one && isLine(one) && <LineFields line={one} all={all} onPatch={onPatch} />}

      {one && one.type === 'text' && (
        <>
          <div>
            <label className={ui.label} htmlFor={`${id}-text`}>
              {t('drawing.props.text')}
            </label>
            <input
              id={`${id}-text`}
              className={ui.input}
              value={one.text}
              onChange={(e) => onPatch(one.id, { text: e.target.value }, `text:${one.id}`)}
            />
          </div>
          <div>
            <label className={ui.label} htmlFor={`${id}-size`}>
              {t('drawing.props.size')}
            </label>
            <input
              id={`${id}-size`}
              type="range"
              min={0.3}
              max={2}
              step={0.1}
              className="w-full accent-orange-500"
              value={one.size}
              onChange={(e) => onPatch(one.id, { size: Number(e.target.value) }, `size:${one.id}`)}
            />
          </div>
        </>
      )}

      {one && one.type === 'zone' && (
        <div>
          <label className={ui.label} htmlFor={`${id}-shape`}>
            {t('drawing.props.shape')}
          </label>
          <select id={`${id}-shape`} className={ui.input} value={one.shape} onChange={(e) => onPatch(one.id, { shape: e.target.value as 'rect' | 'ellipse' }, `shape:${one.id}`)}>
            <option value="rect">{t('drawing.props.rect')}</option>
            <option value="ellipse">{t('drawing.props.ellipse')}</option>
          </select>
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" className={ui.secondary} onClick={onDuplicate}>
          <Copy className="h-4 w-4" aria-hidden="true" /> {t('drawing.props.duplicate')}
        </button>
        <button type="button" className={ui.secondary} onClick={onDelete}>
          <Trash2 className="h-4 w-4" aria-hidden="true" /> {t('drawing.props.delete')}
        </button>
      </div>
    </div>
  );
}

function LineFields({ line, all, onPatch }: { line: LineElement; all: CourtElement[]; onPatch: Props['onPatch'] }) {
  const { t } = useTranslation();
  const id = useId();
  const from = line.fromElementId ? all.find((e) => e.id === line.fromElementId) : undefined;
  const fromName = from && 'label' in from ? `${from.type === 'defense' ? 'X' : from.type === 'coach' ? '' : 'O'}${from.label ?? ''}` : '';
  return (
    <>
      <div>
        <label className={ui.label} htmlFor={`${id}-type`}>
          {t('drawing.props.lineType')}
        </label>
        <select id={`${id}-type`} className={ui.input} value={line.type} onChange={(e) => onPatch(line.id, { type: e.target.value as LineElement['type'] }, `type:${line.id}`)}>
          {LINE_TYPES.map((lt) => (
            <option key={lt} value={lt}>
              {t(`drawing.tool.${lt}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end gap-3">
        <div className="w-24">
          <label className={ui.label} htmlFor={`${id}-order`}>
            {t('drawing.props.order')}
          </label>
          <input
            id={`${id}-order`}
            type="number"
            min={0}
            max={99}
            className={ui.input}
            value={line.order ?? ''}
            onChange={(e) => onPatch(line.id, { order: e.target.valueAsNumber > 0 ? Math.round(e.target.valueAsNumber) : undefined }, `order:${line.id}`)}
          />
        </div>
        <label className="flex items-center gap-2 pb-1.5">
          <input
            type="checkbox"
            className="accent-orange-500"
            checked={line.curved}
            disabled={line.points.length < 3}
            onChange={(e) => onPatch(line.id, { curved: e.target.checked }, `curved:${line.id}`)}
          />
          {t('drawing.props.curved')}
        </label>
      </div>
      {from && <p className="text-xs text-slate-500 dark:text-slate-400">{t('drawing.props.attached', { name: fromName })}</p>}
      <p className="text-xs text-slate-500 dark:text-slate-400">{t('drawing.props.hint')}</p>
    </>
  );
}
