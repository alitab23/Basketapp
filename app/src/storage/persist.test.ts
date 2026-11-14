import { describe, expect, it, vi } from 'vitest';
import { requestPersistentStorage } from './persist';

const storage = (persisted: boolean, grant: boolean) =>
  ({ persisted: vi.fn().mockResolvedValue(persisted), persist: vi.fn().mockResolvedValue(grant) }) as unknown as StorageManager;

describe('requestPersistentStorage', () => {
  it('does not ask again when already persisted', async () => {
    const s = storage(true, false);
    expect(await requestPersistentStorage(s)).toBe('persisted');
    expect(s.persist).not.toHaveBeenCalled();
  });

  it('reports when the browser grants the request', async () => {
    expect(await requestPersistentStorage(storage(false, true))).toBe('persisted');
  });

  it('reports best effort when the browser refuses', async () => {
    expect(await requestPersistentStorage(storage(false, false))).toBe('best-effort');
  });

  it('handles browsers without the Storage API', async () => {
    expect(await requestPersistentStorage(undefined)).toBe('unsupported');
  });
});
