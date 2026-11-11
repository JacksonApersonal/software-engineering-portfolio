import { useEffect, useRef, type RefObject } from 'react';
import { useLocation } from 'react-router';
import { projects } from '../data/projects';

const siteOrigin = 'https://www.jacksonacord.dev';

type RouteMetadata = {
  title: string;
  description: string;
  canonicalPath: string;
};

type RouteExperienceProps = {
  mainContentRef: RefObject<HTMLElement | null>;
};

export function RouteExperience({ mainContentRef }: RouteExperienceProps) {
  const location = useLocation();
  const previousPathnameRef = useRef(location.pathname);

  useEffect(() => {
    const metadata = getRouteMetadata(location.pathname);
    const canonicalUrl = `${siteOrigin}${metadata.canonicalPath}`;

    document.title = metadata.title;
    updateMetaContent('meta[name="description"]', metadata.description);
    updateMetaContent('meta[property="og:title"]', metadata.title);
    updateMetaContent('meta[property="og:description"]', metadata.description);
    updateMetaContent('meta[property="og:url"]', canonicalUrl);
    updateMetaContent('meta[name="twitter:title"]', metadata.title);
    updateMetaContent(
      'meta[name="twitter:description"]',
      metadata.description,
    );
    document
      .querySelector<HTMLLinkElement>('link[rel="canonical"]')
      ?.setAttribute('href', canonicalUrl);
  }, [location.pathname]);

  useEffect(() => {
    if (previousPathnameRef.current === location.pathname) {
      return;
    }

    previousPathnameRef.current = location.pathname;
    const animationFrame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      mainContentRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [location.pathname, mainContentRef]);

  return null;
}

function getRouteMetadata(pathname: string): RouteMetadata {
  const normalizedPath =
    pathname !== '/' ? pathname.replace(/\/+$/, '') || '/' : '/';

  const staticRoutes: Record<string, RouteMetadata> = {
    '/': {
      title: 'Jackson Acord | Software Engineer',
      description:
        'Software engineer portfolio featuring tested React applications, serverless APIs, Redis persistence, OAuth, and algorithm visualization.',
      canonicalPath: '/',
    },
    '/projects': {
      title: 'Software Engineering Projects | Jackson Acord',
      description:
        'Explore interactive software projects covering pathfinding, Redis-backed redirects, Spotify OAuth, deterministic particle simulation, React, TypeScript, and automated testing.',
      canonicalPath: '/projects',
    },
    '/about': {
      title: 'About | Jackson Acord',
      description:
        'Learn about Jackson Acord’s experience with C#/.NET applications, APIs, system integration, test automation, React, and full-stack engineering.',
      canonicalPath: '/about',
    },
    '/resume': {
      title: 'Resume | Jackson Acord',
      description:
        'Review Jackson Acord’s software engineering experience, technical skills, testing background, and education.',
      canonicalPath: '/resume',
    },
    '/projects/pathfinding-visualizer/demo': {
      title: 'Pathfinding Visualizer Demo | Jackson Acord',
      description:
        'Interact with a tested TypeScript visualizer for BFS, Dijkstra, and A* pathfinding across walls and weighted terrain.',
      canonicalPath: '/projects/pathfinding-visualizer/demo',
    },
    '/projects/url-shortener/demo': {
      title: 'URL Shortener Demo | Jackson Acord',
      description:
        'Create a persistent short link using a production Vercel Function and atomic Upstash Redis storage.',
      canonicalPath: '/projects/url-shortener/demo',
    },
  };
  const staticMetadata = staticRoutes[normalizedPath];

  if (staticMetadata) {
    return staticMetadata;
  }

  const projectMatch = normalizedPath.match(/^\/projects\/([^/]+)$/);
  const project = projectMatch
    ? projects.find((item) => item.slug === projectMatch[1])
    : undefined;

  if (project) {
    return {
      title: `${project.title} | Jackson Acord`,
      description: project.summary,
      canonicalPath: `/projects/${project.slug}`,
    };
  }

  return {
    title: 'Page Not Found | Jackson Acord',
    description:
      'The requested page could not be found. Explore Jackson Acord’s software engineering projects and portfolio.',
    canonicalPath: '/',
  };
}

function updateMetaContent(selector: string, content: string) {
  document
    .querySelector<HTMLMetaElement>(selector)
    ?.setAttribute('content', content);
}
