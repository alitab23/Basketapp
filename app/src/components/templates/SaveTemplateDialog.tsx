import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../../db/schema';
import { createTemplate } from '../../db/repository';
import type { Template } from '../../types/model';
import { Modal } from '../Modal';
import { ui } from '../ui';
import { useToast } from '../Toast';

export const parseTags = (text: string) => [...new Set(text.split(',').map((x) => x.trim()).filter(Boolean))];

/** "Spara som template" from a season, a session, a drill or a block. */
export function SaveTemplateDialog({
  kind,
  defaultName,
  content,
  onClose,
}: {
  kind: Template['kind'];
  defaultName: string;
  content: () => Promise<Template['content']> | Template['content'];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const id = useId();
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const tpl = await createTemplate(db, { kind, name: name.trim() || defaultName, description: description.trim() || undefined, tags: parseTags(tags), content: await content() });
    toast(t('templates.saved', { name: tpl.name }));
    onClose();
  }

  return (
    <Modal
      title={`${t('templates.saveTitle')} – ${t(`templates.kind.${kind}`)}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={ui.secondary} onClick={onClose}>
            {t('templates.cancel')}
          </button>
          <button type="button" className={ui.primary} onClick={() => void save()} disabled={busy}>
            {t('templates.save')}
          </button>
        </>
      }
    >
      <div>
        <label className={ui.label} htmlFor={`${id}-name`}>
          {t('templates.name')}
        </label>
        <input id={`${id}-name`} className={ui.input} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className={ui.label} htmlFor={`${id}-description`}>
          {t('templates.description')}
        </label>
        <textarea id={`${id}-description`} rows={2} className={ui.input} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <label className={ui.label} htmlFor={`${id}-tags`}>
          {t('templates.tags')}
        </label>
        <input id={`${id}-tags`} className={ui.input} value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t('drill.tagsHint')} />
      </div>
    </Modal>
  );
}
