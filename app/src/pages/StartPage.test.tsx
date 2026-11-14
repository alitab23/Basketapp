import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import i18n from '../i18n';
import { db } from '../db/schema';
import { createSeason, createSession } from '../db/repository';
import { StartPage } from './StartPage';

function Shown({ kind }: { kind: string }) {
  const { id } = useParams();
  return <p>{`${kind}:${id}`}</p>;
}

const renderStart = () =>
  render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<StartPage />} />
        <Route path="/pass/:id" element={<Shown kind="pass" />} />
        <Route path="/sasong/:id" element={<Shown kind="season" />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(async () => {
  await i18n.changeLanguage('sv');
  await Promise.all([db.sessions.clear(), db.seasons.clear()]);
});
afterEach(cleanup);

describe('StartPage', () => {
  it('shows empty states when there is nothing saved', async () => {
    renderStart();
    expect(await screen.findByText(/Inga pass ännu/)).toBeInTheDocument();
    expect(await screen.findByText('Inga säsonger ännu.')).toBeInTheDocument();
  });

  it('creates a session and opens it', async () => {
    renderStart();
    fireEvent.click(screen.getByRole('button', { name: /Nytt pass/ }));
    expect(await screen.findByText(/^pass:/)).toBeInTheDocument();
    expect(await db.sessions.count()).toBe(1);
  });

  it('creates a season and opens it', async () => {
    renderStart();
    fireEvent.click(screen.getByRole('button', { name: /Ny säsong/ }));
    expect(await screen.findByText(/^season:/)).toBeInTheDocument();
    expect(await db.seasons.count()).toBe(1);
  });

  it('lists sessions with blocks, time and age, and seasons with totals', async () => {
    const season = await createSeason(db, { name: 'U16', startDate: '2026-08-01', endDate: '2027-04-30' });
    await createSession(db, {
      title: 'Tisdag',
      seasonId: season.id,
      items: [10, 20].map((duration, i) => ({ id: `b${i}`, kind: 'block', title: 'x', duration, instructions: '', diagrams: [], images: [] })),
    });
    renderStart();
    expect(await screen.findByTestId('session-list')).toHaveTextContent('Tisdag2 block · 30 min · ändrad nu');
    expect(await screen.findByTestId('season-list')).toHaveTextContent('U161 pass · 30 min');
  });

  it('switches to English', async () => {
    await i18n.changeLanguage('en');
    renderStart();
    expect(screen.getByRole('button', { name: /New session/ })).toBeInTheDocument();
  });
});
