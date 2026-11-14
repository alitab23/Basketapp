export type PersistState = 'persisted' | 'best-effort' | 'unsupported';

/**
 * Asks the browser not to evict our IndexedDB data under storage pressure.
 * Data without an account lives only here, so this matters.
 */
export async function requestPersistentStorage(storage: StorageManager | undefined = globalThis.navigator?.storage): Promise<PersistState> {
  if (!storage?.persist || !storage.persisted) return 'unsupported';
  try {
    if (await storage.persisted()) return 'persisted';
    return (await storage.persist()) ? 'persisted' : 'best-effort';
  } catch {
    return 'best-effort';
  }
}
