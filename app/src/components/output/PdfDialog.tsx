import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDown, Loader2 } from 'lucide-react';
import i18n, { LANGUAGES, type Language } from '../../i18n';
import { db } from '../../db/schema';
import { downloadBlob, withExtension } from '../../exchange/csv';
import { exportFileName } from '../../exchange/format';
import { DEFAULT_PDF_OPTIONS, documentModel, photoIds, type PdfOptions } from '../../pdf/model';
import { makePdf } from '../../pdf/pdfClient';
import { Modal } from '../Modal';
import { useToast } from '../Toast';
import { ui } from '../ui';
import { loadPhotos, loadTarget, type OutputTarget } from './target';
import { TargetPicker } from './TargetPicker';

const OPTIONS_KEY = 'basketapp.pdfOptions';

function storedOptions(language: Language): PdfOptions {
  try {
    const saved = JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? '{}') as Partial<PdfOptions>;
    return { ...DEFAULT_PDF_OPTIONS, ...saved, language };
  } catch {
    return { ...DEFAULT_PDF_OPTIONS, language };
  }
}

/**
 * "Exportera som PDF" (SPEC.md section 7): options, a live preview and download.
 * The PDF is built in a Web Worker; this dialog and the PDF code load only when opened.
 */
export default function PdfDialog({ target: initial, onClose }: { target?: OutputTarget; onClose: () => void }) {
  const { t, i18n: active } = useTranslation();
  const toast = useToast();
  const id = useId();
  const [target, setTarget] = useState<OutputTarget | null>(initial ?? null);
  const [options, setOptions] = useState<PdfOptions>(() => storedOptions((active.language as Language) ?? 'sv'));
  const [pdf, setPdf] = useState<{ blob: Blob; url: string; name: string; ms: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useRef(0);
  const url = useRef<string | null>(null);

  const set = <K extends keyof PdfOptions>(key: K, value: PdfOptions[K]) => {
    setOptions((o) => {
      const next = { ...o, [key]: value };
      try {
        const { language: _language, ...keep } = next;
        localStorage.setItem(OPTIONS_KEY, JSON.stringify(keep));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Rebuild the preview shortly after each change of target or option.
  useEffect(() => {
    if (!target) return;
    const mine = ++run.current;
    setBusy(true);
    setError(null);
    const timer = setTimeout(async () => {
      try {
        const started = performance.now();
        const data = await loadTarget(db, target);
        if (!data) throw new Error('missing');
        const photos = await loadPhotos(db, photoIds(data.sessions));
        const tr = i18n.getFixedT(options.language);
        const model = documentModel(
          data.season ? { season: data.season, sessions: data.sessions } : { session: data.sessions[0]! },
          data.blockTypes,
          photos,
          options,
          (k, o) => tr(k, o ?? {}),
        );
        const blob = await makePdf(model);
        if (mine !== run.current) return;
        const ms = Math.round(performance.now() - started);
        if (url.current) URL.revokeObjectURL(url.current);
        url.current = URL.createObjectURL(blob);
        setPdf({ blob, url: url.current, name: withExtension(exportFileName(data.title), 'pdf'), ms });
      } catch (err) {
        if (mine === run.current) setError(t('pdf.error', { detail: err instanceof Error ? err.message : String(err) }));
      } finally {
        if (mine === run.current) setBusy(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [target, options, t]);

  useEffect(() => () => void (url.current && URL.revokeObjectURL(url.current)), []);

  function download() {
    if (!pdf) return;
    downloadBlob(pdf.blob, pdf.name);
    toast(t('pdf.done', { file: pdf.name }));
    onClose();
  }

  const radio = <K extends keyof PdfOptions>(key: K, value: PdfOptions[K], label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="radio" name={`${id}-${key}`} className="accent-orange-500" checked={options[key] === value} onChange={() => set(key, value)} />
      {label}
    </label>
  );

  return (
    <Modal
      title={t('pdf.title')}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className={ui.secondary} onClick={onClose}>
            {t('templates.cancel')}
          </button>
          <button type="button" className={ui.primary} disabled={!pdf || busy} onClick={download}>
            <FileDown className="h-4 w-4" aria-hidden="true" /> {t('pdf.download')}
          </button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
        <div className="space-y-4">
          {!initial && <TargetPicker value={target} onChange={setTarget} />}
          <fieldset className="space-y-1">
            <legend className="mb-1 text-sm font-medium">{t('pdf.orientation')}</legend>
            {radio('orientation', 'portrait', t('pdf.portrait'))}
            {radio('orientation', 'landscape', t('pdf.landscape'))}
          </fieldset>
          <fieldset className="space-y-1">
            <legend className="mb-1 text-sm font-medium">{t('pdf.color')}</legend>
            {radio('color', true, t('pdf.colorOn'))}
            {radio('color', false, t('pdf.colorOff'))}
          </fieldset>
          <fieldset className="space-y-1">
            <legend className="mb-1 text-sm font-medium">{t('pdf.content')}</legend>
            {radio('instructions', true, t('pdf.withInstructions'))}
            {radio('instructions', false, t('pdf.withoutInstructions'))}
          </fieldset>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">{t('pdf.perRow')}</legend>
            <div className="flex gap-4">
              {radio('perRow', 1, '1')}
              {radio('perRow', 2, '2')}
              {radio('perRow', 3, '3')}
            </div>
          </fieldset>
          <label className="block text-sm font-medium">
            {t('pdf.language')}
            <select className={`${ui.input} mt-1`} value={options.language} onChange={(e) => set('language', e.target.value as Language)}>
              {LANGUAGES.map((lng) => (
                <option key={lng} value={lng}>
                  {t(`language.${lng}`)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="relative min-h-[24rem] rounded-lg bg-slate-100 dark:bg-slate-900" data-testid="pdf-preview" data-ready={!!pdf && !busy} data-ms={pdf?.ms}>
          {pdf && <iframe title={t('pdf.preview')} src={`${pdf.url}#view=FitH`} className="h-[60vh] w-full rounded-lg border-0" />}
          {busy && (
            <p role="status" className="absolute inset-x-0 top-3 mx-auto flex w-fit items-center gap-2 rounded-full bg-white px-3 py-1 text-sm shadow dark:bg-slate-800">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t('pdf.making')}
            </p>
          )}
          {error && (
            <p role="alert" className="m-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-100">
              {error}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
