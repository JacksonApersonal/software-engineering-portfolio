import { createBrowserRouter, RouterProvider } from 'react-router';

import { Layout } from './components/Layout';
import { AboutPage } from './pages/AboutPage';
import { HomePage } from './pages/HomePage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ResumePage } from './pages/ResumePage';
import { PathfindingDemoPage } from './pages/PathFindingDemoPage';

const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
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
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}