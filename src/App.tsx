import { createBrowserRouter, RouterProvider } from 'react-router';

import { Layout } from './components/Layout';
import { AboutPage } from './pages/AboutPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage, RouteErrorPage } from './pages/ErrorPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ResumePage } from './pages/ResumePage';
import { PathfindingDemoPage } from './pages/PathFindingDemoPage';
import { UrlShortenerDemoPage } from './pages/UrlShortenerDemoPage';

const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    ErrorBoundary: RouteErrorPage,
    children: [
      {
        index: true,
        Component: HomePage,
      },
      {
        path: 'projects',
        Component: ProjectsPage,
      },
      {
        path: 'projects/pathfinding-visualizer/demo',
        Component: PathfindingDemoPage,
      },
      {
        path: 'projects/url-shortener/demo',
        Component: UrlShortenerDemoPage,
      },
      {
        path: 'projects/:slug',
        Component: ProjectDetailPage,
      },
      {
        path: 'about',
        Component: AboutPage,
      },
      {
        path: 'resume',
        Component: ResumePage,
      },
      {
        path: '*',
        Component: NotFoundPage,
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
