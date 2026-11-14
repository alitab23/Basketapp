import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '../i18n';
import i18n from '../i18n';
import { db } from '../db/schema';
import { StartPage } from './StartPage';

beforeEach(async () => {
  await i18n.changeLanguage('sv');
  await db.sessions.clear();
});
afterEach(cleanup);

describe('StartPage', () => {
  it('shows an empty state when there are no sessions', async () => {
    render(<StartPage />);
    expect(await screen.findByText(/Inga pass ännu/)).toBeInTheDocument();
  });

  it('creates a session that appears in the list with blocks, time and age', async () => {
    render(<StartPage />);
    fireEvent.click(screen.getByRole('button', { name: /Nytt pass/ }));
    const list = await screen.findByTestId('session-list');
    expect(list).toHaveTextContent('Nytt pass');
    expect(list).toHaveTextContent('0 block · 0 min · ändrad nu');
    expect(await db.sessions.count()).toBe(1);
  });

  it('switches to English', async () => {
    await i18n.changeLanguage('en');
    render(<StartPage />);
    expect(screen.getByRole('button', { name: /New session/ })).toBeInTheDocument();
  });
});
