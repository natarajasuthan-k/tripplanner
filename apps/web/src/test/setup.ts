import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { resetMyTripsCache } from '../lib/myTrips';
import { resetPreferencesCache } from '../lib/preferences';

// Lazy route chunks compile on first use in tests; allow more than the default 1s.
configure({ asyncUtilTimeout: 15_000 });

afterEach(() => {
  cleanup();
  localStorage.clear();
  resetMyTripsCache();
  resetPreferencesCache();
  document.documentElement.classList.remove('dark');
  vi.unstubAllGlobals();
});
