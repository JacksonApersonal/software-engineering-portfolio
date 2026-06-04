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
    slug: 'software-engineering-portfolio',
    title: 'Software Engineering Portfolio',
    language: 'TypeScript',
    summary:
      'A modern portfolio website built to showcase software engineering projects, resume experience, and technical writeups.',
    problem:
      'A resume can summarize experience, but it does not show how someone structures a project, explains technical work, or presents software in a usable way.',
    solution:
      'This portfolio uses React, TypeScript, Vite, Tailwind CSS, and React Router to present project work, resume experience, contact links, and detailed project writeups in a clean modern interface.',
    concepts: ['React', 'TypeScript', 'Routing', 'Responsive Design'],
    features: [
      'Modern grayscale interface built with Tailwind CSS.',
      'Route-based pages for home, projects, about, resume, and project details.',
      'Reusable project card and project detail components.',
      'Data-driven project pages using a shared project model.',
      'Live deployment through Vercel.',
    ],
    testingStrategy: [
      'Manual route testing for all main pages.',
      'Responsive layout checks across desktop and mobile widths.',
      'Production build validation using Vite.',
      'Link validation for contact, GitHub, LinkedIn, and deployed project URLs.',
    ],
    status: 'Complete',
    repoUrl: 'https://github.com/JacksonApersonal/software-engineering-portfolio',
    demoUrl: 'https://software-engineering-portfolio-lilac.vercel.app/',
  },
  {
    slug: 'pathfinding-visualizer',
    title: 'Pathfinding Visualizer',
    language: 'Python',
    summary:
      'An interactive algorithm visualizer for comparing BFS, Dijkstra, and A* pathfinding.',
    problem:
      'Pathfinding algorithms are often taught abstractly, which makes it hard to understand how they explore a graph, choose paths, and make tradeoffs.',
    solution:
      'This project will visualize grid-based pathfinding step by step, allowing users to place walls, choose algorithms, run searches, and compare the resulting paths.',
    concepts: ['Algorithms', 'Graphs', 'Visualization', 'Testing'],
    features: [
      'Interactive grid with start, end, and wall placement.',
      'BFS, Dijkstra, and A* algorithm implementations.',
      'Step-by-step visualization of visited nodes and final path.',
      'Comparison notes explaining algorithm tradeoffs.',
    ],
    testingStrategy: [
      'Unit tests for each pathfinding algorithm.',
      'Tests for unreachable targets and blocked paths.',
      'Tests for shortest-path correctness on known grid layouts.',
      'Regression tests for edge cases like start equals target.',
    ],
    status: 'Planned',
  },
  {
    slug: 'url-shortener',
    title: 'URL Shortener Service',
    language: 'Java',
    summary:
      'A backend service that creates short links, handles redirects, tracks clicks, and manages expiration.',
    problem:
      'URL shorteners look simple from the outside, but they involve useful backend engineering problems like unique key generation, persistence, redirects, analytics, and expiration.',
    solution:
      'This project will implement a Java REST API that creates short links, redirects users, stores metadata, and exposes basic analytics for link usage.',
    concepts: ['REST APIs', 'Databases', 'Hashing', 'Backend Design'],
    features: [
      'Create short URLs from long URLs.',
      'Redirect short links to their original destination.',
      'Track click counts and creation timestamps.',
      'Support optional expiration dates.',
    ],
    testingStrategy: [
      'Unit tests for short-code generation.',
      'API tests for create, redirect, and lookup flows.',
      'Database tests for persistence and expiration behavior.',
      'Validation tests for invalid or malformed URLs.',
    ],
    status: 'Planned',
  },
  {
    slug: 'real-time-chat',
    title: 'Real-Time Chat App',
    language: 'C#',
    summary:
      'A real-time messaging application using a C# backend, persistent chat rooms, and live updates.',
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