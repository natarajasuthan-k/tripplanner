import { lazy } from 'react';
import type { RouteObject } from 'react-router';
import { AppShell } from './components/AppShell';
import NotFoundPage from './pages/NotFoundPage';

// Route table — frontend-spec §2. Each page is its own chunk (performance budget, §8).
const HomePage = lazy(() => import('./pages/HomePage'));
const CreateTripPage = lazy(() => import('./pages/CreateTripPage'));
const TripPage = lazy(() => import('./pages/TripPage'));
const ExplorePage = lazy(() => import('./pages/ExplorePage'));
const PublishedTripPage = lazy(() => import('./pages/PublishedTripPage'));
const RecoverPage = lazy(() => import('./pages/RecoverPage'));
const HowItWorksPage = lazy(() => import('./pages/HowItWorksPage'));

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/new', element: <CreateTripPage /> },
      { path: '/o/:token', element: <TripPage mode="organiser" /> },
      { path: '/e/:token', element: <TripPage mode="editor" /> },
      { path: '/v/:token', element: <TripPage mode="viewer" /> },
      { path: '/explore', element: <ExplorePage /> },
      { path: '/explore/:slug', element: <PublishedTripPage /> },
      { path: '/recover', element: <RecoverPage /> },
      { path: '/how-it-works', element: <HowItWorksPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
