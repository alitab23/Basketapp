import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { FileUp } from 'lucide-react';
import { db } from '../../db/schema';
import type { ImportCounts } from '../../exchange/format';
import type { ParseError, ParseResult } from '../../exchange/parse';
import { parseInWorker } from '../../exchange/importClient';
import { applyImport, type ImportMode } from '../../exchange/applyImport';
import { Modal } from '../Modal';
import { useToast } from '../Toast';
import { ui } from '../ui';

export function useCountsText() {
  const { t } = useTranslation();
  return (c: ImportCounts) =>
    (['seasons', 'sessions', 'drills', 'templates', 'images'] as const)
      .filter((k) => c[k] > 0)
      .map((k) => t(`import.counts.${k}`, { count: c[k] }))
      .join(', ');
}

/**
 * "Importera data" (SPEC.md section 7): choose or drop a file, or paste a
 * sessionplan link; it is checked in a Web Worker, a preview shows what it
 * contains, and the user picks copies (default) or replace.
 */
export function ImportDialog({ onClose, initialFile }: { onClose: () => void; initialFile?: File }) {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const id = useId();
  const countsText = useCountsText();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [link, setLink] = useState('');
  const [mode, setMode] = useState<ImportMode>('copies');

  const errorText = (e: ParseError) =>
    e.code === 'unknownVersion'
      ? t('import.errors.unknownVersion', { version: e.version })
      : e.code === 'invalid'
        ? e.detail === 'sessionplan'
          ? t('import.errors.sessionplan')
          : t('import.errors.invalid', { detail: e.detail })
        : t(`import.errors.${e.code}`);

  async function read(text: string) {
    setBusy(true);
    setResult(await parseInWorker(text, t('session.untitled')));
    setBusy(false);
  }

  async function readFile(file: File) {
    try {
      await read(await file.text());
    } catch {
      setResult({ ok: false, error: { code: 'invalidJson' } });
      setBusy(false);
    }
  }

  useEffect(() => {
    if (initialFile) void readFile(initialFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  async function run() {
    if (!result?.ok) return;
    setBusy(true);
    const { counts, sessionIds } = await applyImport(db, result.file, result.source === 'sessionplan' ? 'copies' : mode);
    toast(t('import.done', { summary: countsText(counts) }));
    onClose();
    // A sessionplan import is one session: open it straight away.
    if (result.source === 'sessionplan' && sessionIds[0]) void navigate(`/pass/${sessionIds[0]}`);
  }

  return (
    <Modal
      title={t('import.title')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={ui.secondary} onClick={onClose}>
            {t('templates.cancel')}
          </button>
          <button type="button" className={ui.primary} disabled={!result?.ok || busy} onClick={() => void run()}>
            {t('import.submit')}
          </button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={ui.secondary} onClick={() => fileInput.current?.click()}>
          <FileUp className="h-4 w-4" aria-hidden="true" /> {t('import.choose')}
        </button>
        <span className="text-sm text-slate-500 dark:text-slate-400">{t('import.drop')}</span>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          data-testid="import-input"
          aria-label={t('import.choose')}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void readFile(f);
            e.target.value = '';
          }}
        />
      </div>

      <div>
        <label className={ui.label} htmlFor={`${id}-link`}>
          {t('import.sessionplanLabel')}
        </label>
        <div className="mt-1 flex gap-2">
          <textarea id={`${id}-link`} rows={2} className={ui.input} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://sessionplan.de/#data=v2:…" />
          <button type="button" className={ui.secondary} disabled={!link.trim() || busy} onClick={() => void read(link)}>
            {t('import.sessionplanButton')}
          </button>
        </div>
      </div>

      {busy && <p className="text-sm text-slate-500">{t('import.reading')}</p>}

      {result && !result.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-100">
          {errorText(result.error)}
        </p>
      )}

      {result?.ok && (
        <div className="space-y-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-900" data-testid="import-preview">
          <p className="text-sm">
            <span className="font-medium">{t('import.preview')}</span>{' '}
            {result.source === 'sessionplan' ? t('import.fromSessionplan', { title: result.title }) : countsText(result.counts)}
          </p>
          {result.source === 'basketapp' && (
            <fieldset className="space-y-1">
              <legend className="mb-1 text-sm font-medium">{t('import.mode')}</legend>
              {(['copies', 'replace'] as const).map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm">
                  <input type="radio" name={`${id}-mode`} className="accent-orange-500" checked={mode === m} onChange={() => setMode(m)} />
                  {t(`import.${m}`)}
                </label>
              ))}
            </fieldset>
          )}
        </div>
      )}
    </Modal>
  );
}
