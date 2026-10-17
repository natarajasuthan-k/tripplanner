import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { apiError, installFakeApi } from './test/fakeApi';
import { renderRoute } from './test/renderRoute';

describe('routes (frontend-spec §2)', () => {
  it.each([
    ['/', 'Plan a trip together'],
    ['/new', 'Create a trip'],
    ['/explore', 'Published trips'],
    ['/recover', 'Forgot my link'],
    ['/how-it-works', 'How it works'],
    ['/no/such/page', 'Trip not found'],
  ])('%s renders "%s"', async (path, heading) => {
    renderRoute(path);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  });

  it.each(['/o/abc', '/e/abc', '/v/abc'])(
    '%s shows Trip not found for a bad link (AC2.5)',
    async (path) => {
      installFakeApi([['GET', /^\/trips\//, () => apiError(404, 'NOT_FOUND', 'Trip not found')]]);
      renderRoute(path);
      expect(await screen.findByRole('heading', { name: 'Trip not found' })).toBeInTheDocument();
    },
  );
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
