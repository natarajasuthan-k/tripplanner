import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TOKENS } from '../test/builders';
import { renderRoute } from '../test/renderRoute';

describe('HomePage', () => {
  it('explains the app and the three links (AC16.1)', async () => {
    renderRoute('/');
    const how = await screen.findByRole('region', { name: 'How it works' });
    expect(within(how).getByText('Organiser link')).toBeVisible();
    expect(within(how).getByText('Edit link')).toBeVisible();
    expect(within(how).getByText('View-only link')).toBeVisible();
    expect(screen.getByRole('link', { name: /read the full guide/i })).toHaveAttribute(
      'href',
      '/how-it-works',
    );
  });

  it('hides “Your trips” when nothing is stored', async () => {
    renderRoute('/');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText('Your trips on this device')).toBeNull();
  });

  it('lists trips on this device and removes them locally (AC13.1, AC13.3)', async () => {
    localStorage.setItem(
      'tp.myTrips',
      JSON.stringify([
        {
          name: 'Kyoto Winter',
          role: 'organiser',
          token: TOKENS.organiser,
          lastOpenedAt: '2026-10-17T09:00:00.000Z',
        },
        {
          name: 'Goa Beach',
          role: 'editor',
          token: TOKENS.editor,
          lastOpenedAt: '2026-10-16T09:00:00.000Z',
        },
      ]),
    );
    renderRoute('/');
    const list = await screen.findByRole('region', { name: 'Your trips on this device' });
    const links = within(list).getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      `/o/${TOKENS.organiser}`,
      `/e/${TOKENS.editor}`,
    ]);
    await userEvent.click(
      within(list).getByRole('button', { name: 'Remove Goa Beach from this device' }),
    );
    expect(within(list).queryByText('Goa Beach')).toBeNull();
    expect(localStorage.getItem('tp.myTrips')).not.toContain('Goa Beach');
  });
});

describe('HowItWorksPage', () => {
  it('can bring dismissed tips back (AC16.4)', async () => {
    localStorage.setItem('tp.tipsSeen', JSON.stringify(['organiser', 'editor']));
    renderRoute('/how-it-works');
    await userEvent.click(await screen.findByRole('button', { name: 'Show tips again' }));
    expect(localStorage.getItem('tp.tipsSeen')).toBe('[]');
  });
});
