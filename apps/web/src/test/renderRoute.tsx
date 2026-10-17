import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ToastProvider } from '../components/ui/Toaster';
import { createQueryClient } from '../lib/queryClient';
import { routes } from '../routes';
import { ThemeProvider } from '../theme/ThemeProvider';

/** Render the real route table at `path` with all app providers. */
export function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <QueryClientProvider client={createQueryClient()}>
      <ThemeProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return { ...view, router };
}
