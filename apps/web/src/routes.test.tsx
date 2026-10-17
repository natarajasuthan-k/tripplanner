import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderRoute } from './test/renderRoute';

describe('routes (frontend-spec §2)', () => {
  it.each([
    ['/', 'Plan a trip together'],
    ['/new', 'Create a trip'],
    ['/new?from=kyoto-winter', 'Copy this plan'],
    ['/o/abc', 'Trip — organiser'],
    ['/e/abc', 'Trip — editor'],
    ['/v/abc', 'Trip — view only'],
    ['/explore', 'Published trips'],
    ['/explore/kyoto-winter', 'Published trip'],
    ['/recover', 'Forgot my link'],
    ['/how-it-works', 'How it works'],
    ['/no/such/page', 'Trip not found'],
  ])('%s renders "%s"', async (path, heading) => {
    renderRoute(path);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  });
});

describe('ThemeToggle', () => {
  it('switches to dark and remembers the choice', async () => {
    renderRoute('/');
    await userEvent.click(await screen.findByRole('radio', { name: 'Dark theme' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('tp.theme')).toBe('dark');

    await userEvent.click(screen.getByRole('radio', { name: 'Light theme' }));
    expect(document.documentElement).not.toHaveClass('dark');
  });
});
