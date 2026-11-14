import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Block } from '../../types/model';
import { renderMarkdown } from '../../lib/markdown';
import { ui } from '../ui';
import type { BlockPatch } from './BlockRow';

interface Props {
  block: Block;
  onChange: (patch: BlockPatch, coalesceKey: string) => void;
}

/** Expanded block: markdown instructions, equipment and players. The drawing tool arrives in step 3. */
export default function BlockDetails({ block, onChange }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const [tab, setTab] = useState<'write' | 'preview'>('write');

  const tabClass = (active: boolean) =>
    `rounded-md px-2.5 py-1 text-xs font-medium ${
      active ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
    }`;

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <label className={ui.label} htmlFor={`${id}-instructions`}>
            {t('block.instructions')}
          </label>
          <div role="tablist" className="ml-auto flex gap-1">
            <button type="button" role="tab" aria-selected={tab === 'write'} className={tabClass(tab === 'write')} onClick={() => setTab('write')}>
              {t('block.write')}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'preview'} className={tabClass(tab === 'preview')} onClick={() => setTab('preview')}>
              {t('block.preview')}
            </button>
          </div>
        </div>
        {tab === 'write' ? (
          <>
            <textarea
              id={`${id}-instructions`}
              rows={6}
              className={`${ui.input} font-mono`}
              value={block.instructions}
              onChange={(e) => onChange({ instructions: e.target.value }, `instructions:${block.id}`)}
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('block.instructionsHint')}</p>
          </>
        ) : block.instructions.trim() ? (
          <div
            data-testid="instructions-preview"
            className="markdown rounded-md border border-slate-200 p-3 text-sm dark:border-slate-700"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(block.instructions) }}
          />
        ) : (
          <p className="text-sm text-slate-500">{t('block.nothingToPreview')}</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={ui.label} htmlFor={`${id}-material`}>
            {t('block.material')}
          </label>
          <input
            id={`${id}-material`}
            className={ui.input}
            placeholder={t('block.materialPlaceholder')}
            value={block.material ?? ''}
            onChange={(e) => onChange({ material: e.target.value || undefined }, `material:${block.id}`)}
          />
        </div>
        <div>
          <label className={ui.label} htmlFor={`${id}-players`}>
            {t('block.playersNeeded')}
          </label>
          <input
            id={`${id}-players`}
            className={ui.input}
            placeholder={t('block.playersNeededPlaceholder')}
            value={block.playersNeeded ?? ''}
            onChange={(e) => onChange({ playersNeeded: e.target.value || undefined }, `players:${block.id}`)}
          />
        </div>
      </div>
    </div>
  );
}
