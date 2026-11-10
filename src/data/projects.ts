export type Project = {
  slug: string;
  title: string;
  language: 'TypeScript' | 'Python' | 'Java' | 'C#';
  summary: string;
  problem: string;
  solution: string;
  concepts: string[];
  features: string[];
  testingStrategy: string[];
  status: 'Planned' | 'In Progress' | 'Complete';
  repoUrl?: string;
  demoUrl?: string;
};

export const projects: Project[] = [
  {
    slug: 'pathfinding-visualizer',
    title: 'Pathfinding Visualizer',
    language: 'TypeScript',
    summary:
      'An interactive algorithm visualizer for comparing BFS, Dijkstra, and A* pathfinding.',
    problem:
      'Pathfinding algorithms are often taught abstractly, which makes it hard to understand how they explore a graph, choose paths, and make tradeoffs.',
    solution:
      'This project visualizes grid-based pathfinding step by step, allowing users to place walls, add weighted terrain, choose an algorithm, run the search, and compare the resulting path behavior.',
    concepts: ['Algorithms', 'Graphs', 'Visualization', 'Testing'],
    features: [
      'Interactive grid with start, end, wall, and weighted terrain cells.',
      'Animated BFS, Dijkstra, and A* pathfinding algorithms.',
      'Step-by-step visualization with move count and weighted traversal cost.',
      'Clear Path and Clear Grid controls that preserve or reset terrain as expected.',
      'Algorithm selector with status messages explaining current behavior.',
    ],
    testingStrategy: [
      'Vitest model and algorithm regression tests cover path reconstruction, metrics, terrain preservation, and search behavior.',
      'A one-step adjacent path test verifies endpoint-inclusive reconstruction and move counting.',
      'A weighted-grid test verifies that BFS minimizes moves while Dijkstra and A* minimize traversal cost.',
      'Model-level tests verify terrain editing and arrow-key position calculations; rendered focus behavior and grid semantics are verified manually in the browser.',
    ],
    status: 'Complete',
    repoUrl: 'https://github.com/JacksonApersonal/software-engineering-portfolio/tree/main/src/components/demos',
    demoUrl: '/projects/pathfinding-visualizer/demo',
  },
  {
    slug: 'url-shortener',
    title: 'URL Shortener',
    language: 'TypeScript',
    summary:
      'A production-verified full-stack URL shortener using React, Vercel Functions, and durable Redis-backed redirects.',
    problem:
      'A useful short link must be safely validated, uniquely generated, persisted beyond a browser session, and resolved reliably without conflicting with the portfolio SPA.',
    solution:
      'The implemented application combines an accessible React demo with TypeScript Vercel Functions, cryptographic Base62 codes, atomic Upstash Redis storage, server-side redirects, and creation rate limiting. Production verification confirms that generated links persist and redirect correctly.',
    concepts: ['TypeScript', 'Vercel Functions', 'Redis', 'API Design'],
    features: [
      'Responsive React form with loading, validation, rate-limit, and service-error states.',
      'Eight-character cryptographic Base62 codes with bounded collision retries.',
      'Atomic Redis reservations that preserve durable destination mappings without expiration.',
      'Server-side temporary redirects with strict method and short-code validation.',
      'Clipboard support and direct access to each generated short link.',
    ],
    testingStrategy: [
      'Vitest coverage for URL normalization, validation, code generation, collisions, and retry exhaustion.',
      'Handler tests for creation, redirects, malformed requests, method restrictions, rate limits, storage failures, and HEAD behavior.',
      'Redis adapter tests verify SET NX reservation semantics and atomic expiring rate-limit counters.',
      'Client tests verify request payloads, API response parsing, local validation, and user-facing error categories.',
      'Manual production verification confirms persistent Redis-backed links and working server-side redirects.',
    ],
    status: 'Complete',
    repoUrl: 'https://github.com/JacksonApersonal/software-engineering-portfolio',
    demoUrl: '/projects/url-shortener/demo',
  },
  {
    slug: 'spotify-music-dashboard',
    title: 'Spotify Music Dashboard',
    language: 'TypeScript',
    summary:
      'A production-verified React and TypeScript dashboard for exploring top Spotify artists and tracks through secure server-side OAuth.',
    problem:
      'Listening data is difficult to interpret when it is spread across individual tracks, artists, and profile views without a focused visual summary.',
    solution:
      'The current implementation uses Vercel Functions for Spotify Authorization Code OAuth, encrypted HttpOnly session cookies, a validated API layer for top-item data, and a responsive React dashboard embedded in the portfolio.',
    concepts: [
      'React',
      'TypeScript',
      'Spotify Web API',
      'OAuth 2.0',
      'Data Visualization',
    ],
    features: [
      'Server-side Spotify Authorization Code OAuth requesting only user-top-read.',
      'Encrypted HttpOnly session cookies with access-token refresh and reauthorization handling.',
      'Responsive ranked views for top artists and tracks across three listening periods.',
      'Accessible loading, disconnected, empty, restricted-account, rate-limit, and service-error states.',
    ],
    testingStrategy: [
      'Vitest coverage for OAuth state handling, token exchange and refresh, encrypted sessions, cookies, and malformed configuration.',
      'Handler tests cover callback validation, authenticated dashboard data, all time ranges, Development Mode restrictions, throttling, expired sessions, and logout.',
      'Frontend client tests verify credentialed requests, response parsing, safe error categories, abort handling, and logout behavior.',
      'Manual production verification confirms the OAuth login flow and authenticated Spotify data loading.',
    ],
    status: 'Complete',
    repoUrl: 'https://github.com/JacksonApersonal/software-engineering-portfolio',
  },
];
