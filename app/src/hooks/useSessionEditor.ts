import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../db/schema';
import type { BasketappDB } from '../db/schema';
import { getDrill, getSession, saveDrill, saveSession } from '../db/repository';
import { canRedo, canUndo, commit, createHistory, redo, undo, type History } from '../lib/history';
import type { Drill, Session } from '../types/model';

export const SAVE_DELAY_MS = 300;

export type EditorState = 'loading' | 'missing' | 'ready';
export type SaveState = 'saved' | 'saving';

/**
 * Holds one document (a session or a drill) while it is being edited:
 * undo/redo history and autosave to IndexedDB shortly after each change
 * (SPEC.md section 4: no save button).
 */
export function useDocEditor<T extends { id: string }>(
  id: string,
  load: (db: BasketappDB, id: string) => Promise<T | undefined>,
  save: (db: BasketappDB, doc: T) => Promise<unknown>,
) {
  const [state, setState] = useState<EditorState>('loading');
  const [history, setHistory] = useState<History<T> | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const lastSaved = useRef<T | null>(null);
  const latest = useRef<T | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  // Load
  useEffect(() => {
    let cancelled = false;
    setState('loading');
    void load(db, id).then((doc) => {
      if (cancelled) return;
      if (!doc) return setState('missing');
      lastSaved.current = doc;
      latest.current = doc;
      setHistory(createHistory(doc));
      setState('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [id, load]);

  const present = history?.present ?? null;

  // Debounced autosave
  useEffect(() => {
    latest.current = present;
    if (!present) return;
    if (present === lastSaved.current) return setSaveState('saved');
    setSaveState('saving');
    const timer = setTimeout(() => {
      void saveRef.current(db, present).then(() => {
        lastSaved.current = present;
        if (latest.current === present) setSaveState('saved');
      });
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [present]);

  // Never lose the last edit when leaving the page or closing the tab.
  useEffect(() => {
    const flush = () => {
      const doc = latest.current;
      if (doc && doc !== lastSaved.current) {
        lastSaved.current = doc;
        void saveRef.current(db, doc);
      }
    };
    window.addEventListener('pagehide', flush);
    const onHidden = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHidden);
      flush();
    };
  }, []);

  /** Applies a change. Changes with the same `coalesceKey` close in time form one undo step. */
  const update = useCallback((change: (doc: T) => T, coalesceKey: string | null = null) => {
    // Show "Sparar…" in the same render as the change, never a stale "Sparat".
    setSaveState('saving');
    setHistory((h) => (h ? commit(h, change(h.present), coalesceKey) : h));
  }, []);

  /** Saves any pending change right away, e.g. before duplicating. */
  const flush = useCallback(async () => {
    const doc = latest.current;
    if (doc && doc !== lastSaved.current) {
      lastSaved.current = doc;
      await saveRef.current(db, doc);
      setSaveState('saved');
    }
  }, []);

  const doUndo = useCallback(() => {
    setSaveState('saving');
    setHistory((h) => (h ? undo(h) : h));
  }, []);
  const doRedo = useCallback(() => {
    setSaveState('saving');
    setHistory((h) => (h ? redo(h) : h));
  }, []);

  return {
    state,
    doc: present,
    saveState,
    update,
    flush,
    undo: doUndo,
    redo: doRedo,
    canUndo: history ? canUndo(history) : false,
    canRedo: history ? canRedo(history) : false,
  };
}

export function useSessionEditor(id: string) {
  const editor = useDocEditor<Session>(id, getSession, saveSession);
  return { ...editor, session: editor.doc };
}

export function useDrillEditor(id: string) {
  const editor = useDocEditor<Drill>(id, getDrill, saveDrill);
  return { ...editor, drill: editor.doc };
}

export type SessionEditor = ReturnType<typeof useSessionEditor>;
