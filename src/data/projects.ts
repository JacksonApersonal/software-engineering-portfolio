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
      'Eleven Vitest regression tests covering path reconstruction, metrics, terrain preservation, search behavior, and accessible interactions.',
      'A one-step adjacent path test verifies endpoint-inclusive reconstruction and move counting.',
      'A weighted-grid test verifies that BFS minimizes moves while Dijkstra and A* minimize traversal cost.',
      'Unreachable-target cases are verified separately for BFS, Dijkstra, and A*.',
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
      'An in-progress full-stack URL shortener using React, Vercel Functions, and durable Redis-backed redirects.',
    problem:
      'A useful short link must be safely validated, uniquely generated, persisted beyond a browser session, and resolved reliably without conflicting with the portfolio SPA.',
    solution:
      'The current implementation combines an accessible React demo with TypeScript Vercel Functions, cryptographic Base62 codes, atomic Upstash Redis storage, server-side redirects, and creation rate limiting. Production deployment verification is still pending.',
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
    ],
    status: 'In Progress',
    repoUrl: 'https://github.com/JacksonApersonal/software-engineering-portfolio',
    demoUrl: '/projects/url-shortener/demo',
  },
  {
    slug: 'real-time-chat',
    title: 'Real-Time Chat Application',
    language: 'C#',
    summary:
      'A planned real-time messaging application using a C# backend, persistent chat rooms, and live updates.',
    problem:
      'Real-time applications require careful handling of live connections, message delivery, state, persistence, and user experience.',
    solution:
      'This project will use ASP.NET Core and SignalR to support live chat rooms, message history, connection events, and a clean browser-based client.',
    concepts: ['ASP.NET Core', 'SignalR', 'Authentication', 'Async Programming'],
    features: [
      'Create and join chat rooms.',
      'Send and receive messages in real time.',
      'Persist message history.',
      'Show connection and user presence events.',
    ],
    testingStrategy: [
      'Unit tests for message and room services.',
      'Integration tests for API endpoints.',
      'SignalR hub tests for connection and message flows.',
      'Manual test scenarios for multiple connected clients.',
    ],
    status: 'Planned',
  },
];
