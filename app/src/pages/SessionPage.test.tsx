import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import i18n from '../i18n';
import { db } from '../db/schema';
import { createSession, ensureDefaults, getSession } from '../db/repository';
import { newBlock } from '../lib/blockOps';
import { SessionPage } from './SessionPage';

const renderSession = (id: string) =>
  render(
    <MemoryRouter initialEntries={[`/pass/${id}`]}>
      <Routes>
        <Route path="/pass/:id" element={<SessionPage />} />
        <Route path="/" element={<p>home</p>} />
      </Routes>
    </MemoryRouter>,
  );

const times = () => screen.getAllByTestId('block-time').map((el) => el.textContent);

beforeEach(async () => {
  await i18n.changeLanguage('sv');
  await Promise.all([db.sessions.clear(), db.meta.clear(), db.blockTypes.clear()]);
  await ensureDefaults(db, (k) => i18n.t(k));
});
afterEach(cleanup);

describe('SessionPage', () => {
  it('shows the times from the acceptance criterion', async () => {
    const s = await createSession(db, {
      title: 'Pass',
      startTime: '18:00',
      items: [10, 15, 5, 30, 20].map((d, i) => newBlock({ title: `Övning ${i + 1}`, duration: d })),
    });
    renderSession(s.id);
    await screen.findAllByTestId('block-row');
    expect(times()).toEqual(['18:00–18:10', '18:10–18:25', '18:25–18:30', '18:30–19:00', '19:00–19:20']);
    expect(screen.getByTestId('session-total')).toHaveTextContent('1 h 20 min');
    expect(screen.getByTestId('session-range')).toHaveTextContent('18:00–19:20');
  });

  it('recalculates all times when a length changes, and undo restores them', async () => {
    const s = await createSession(db, { title: 'Pass', items: [newBlock({ title: 'A', duration: 10 }), newBlock({ title: 'B', duration: 10 })] });
    renderSession(s.id);
    const rows = await screen.findAllByTestId('block-row');
    fireEvent.click(within(rows[0]!).getByRole('button', { name: '5 minuter längre' }));
    expect(times()).toEqual(['18:00–18:15', '18:15–18:25']);
    fireEvent.change(within(rows[1]!).getByTestId('block-duration'), { target: { value: '30' } });
    expect(screen.getByTestId('session-total')).toHaveTextContent('45 min');

    fireEvent.click(screen.getByRole('button', { name: 'Ångra' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ångra' }));
    expect(times()).toEqual(['18:00–18:10', '18:10–18:20']);
    fireEvent.click(screen.getByRole('button', { name: 'Gör om' }));
    expect(times()).toEqual(['18:00–18:15', '18:15–18:25']);
  });

  it('adds a drill, a break and a heading; the heading shows the sum of its part', async () => {
    const s = await createSession(db, { title: 'Pass' });
    renderSession(s.id);
    await screen.findByText(/Passet är tomt/);
    fireEvent.click(screen.getByRole('button', { name: /Rubrik/ }));
    fireEvent.click(screen.getByRole('button', { name: /Övning/ }));
    fireEvent.click(screen.getByRole('button', { name: /Paus/ }));
    expect(screen.getAllByTestId('block-row')).toHaveLength(2);
    expect(screen.getByTestId('section-total')).toHaveTextContent('15 min');
    expect(screen.getByTestId('session-total')).toHaveTextContent('15 min');
  });

  it('autosaves to IndexedDB without a save button', async () => {
    const s = await createSession(db, { title: 'Pass' });
    renderSession(s.id);
    fireEvent.change(await screen.findByLabelText('Titel'), { target: { value: 'Tisdagspass' } });
    await waitFor(async () => expect((await getSession(db, s.id))!.title).toBe('Tisdagspass'));
    await waitFor(() => expect(screen.getByTestId('save-status')).toHaveTextContent('Sparat'));
  });

  it('warns when the session is longer than the gym time limit', async () => {
    const s = await createSession(db, { title: 'Pass', maxDuration: 60, items: [newBlock({ title: 'A', duration: 75 })] });
    renderSession(s.id);
    expect(await screen.findByRole('alert')).toHaveTextContent('15 min längre än maxtiden');
  });

  it('opens a block and previews markdown instructions safely', async () => {
    const s = await createSession(db, { title: 'Pass', items: [newBlock({ title: 'A', instructions: '## Syfte\n- Lay-ups <img src=x onerror=alert(1)>' })] });
    renderSession(s.id);
    await screen.findAllByTestId('block-row');
    fireEvent.click(screen.getByRole('button', { name: 'Visa detaljer' }));
    fireEvent.click(await screen.findByRole('tab', { name: 'Förhandsvisa' }));
    const preview = await screen.findByTestId('instructions-preview');
    expect(within(preview).getByRole('heading', { name: 'Syfte' })).toBeInTheDocument();
    expect(preview.innerHTML).not.toContain('onerror');
  });

  it('duplicates and deletes a block', async () => {
    const s = await createSession(db, { title: 'Pass', items: [newBlock({ title: 'A', duration: 10 })] });
    renderSession(s.id);
    await screen.findAllByTestId('block-row');
    fireEvent.click(screen.getByRole('button', { name: 'Duplicera' }));
    expect(times()).toEqual(['18:00–18:10', '18:10–18:20']);
    fireEvent.click(screen.getAllByRole('button', { name: 'Radera' })[0]!);
    expect(times()).toEqual(['18:00–18:10']);
  });

  it('supports Ctrl+Z outside text fields', async () => {
    const s = await createSession(db, { title: 'Pass', items: [newBlock({ title: 'A', duration: 10 })] });
    renderSession(s.id);
    await screen.findAllByTestId('block-row');
    fireEvent.click(screen.getByRole('button', { name: '5 minuter längre' }));
    act(() => {
      fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    });
    expect(times()).toEqual(['18:00–18:10']);
  });

  it('shows a message for a session that does not exist', async () => {
    renderSession('missing');
    expect(await screen.findByText(/Passet finns inte/)).toBeInTheDocument();
  });
});
