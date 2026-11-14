import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../db/schema';
import { getSession, saveSession } from '../db/repository';
import { canRedo, canUndo, commit, createHistory, redo, undo, type History } from '../lib/history';
import type { Session } from '../types/model';

export const SAVE_DELAY_MS = 300;

export type EditorState = 'loading' | 'missing' | 'ready';
export type SaveState = 'saved' | 'saving';

/**
 * Holds one session while it is being edited: undo/redo history and autosave
 * to IndexedDB shortly after each change (SPEC.md section 4: no save button).
 */
export function useSessionEditor(id: string) {
  const [state, setState] = useState<EditorState>('loading');
  const [history, setHistory] = useState<History<Session> | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const lastSaved = useRef<Session | null>(null);
  const latest = useRef<Session | null>(null);

  // Load
  useEffect(() => {
    let cancelled = false;
    setState('loading');
    void getSession(db, id).then((s) => {
      if (cancelled) return;
      if (!s) return setState('missing');
      lastSaved.current = s;
      latest.current = s;
      setHistory(createHistory(s));
      setState('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const present = history?.present ?? null;

  // Debounced autosave
  useEffect(() => {
    latest.current = present;
    if (!present || present === lastSaved.current) return;
    setSaveState('saving');
    const timer = setTimeout(() => {
      void saveSession(db, present).then(() => {
        lastSaved.current = present;
        if (latest.current === present) setSaveState('saved');
      });
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [present]);

  // Never lose the last edit when leaving the page or closing the tab.
  useEffect(() => {
    const flush = () => {
      const s = latest.current;
      if (s && s !== lastSaved.current) {
        lastSaved.current = s;
        void saveSession(db, s);
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
  const update = useCallback((change: (s: Session) => Session, coalesceKey: string | null = null) => {
    setHistory((h) => (h ? commit(h, change(h.present), coalesceKey) : h));
  }, []);

  /** Saves any pending change right away, e.g. before duplicating. */
  const flush = useCallback(async () => {
    const s = latest.current;
    if (s && s !== lastSaved.current) {
      lastSaved.current = s;
      await saveSession(db, s);
      setSaveState('saved');
    }
  }, []);

  const doUndo = useCallback(() => setHistory((h) => (h ? undo(h) : h)), []);
  const doRedo = useCallback(() => setHistory((h) => (h ? redo(h) : h)), []);

  return {
    state,
    session: present,
    saveState,
    update,
    flush,
    undo: doUndo,
    redo: doRedo,
    canUndo: history ? canUndo(history) : false,
    canRedo: history ? canRedo(history) : false,
  };
}

export type SessionEditor = ReturnType<typeof useSessionEditor>;
