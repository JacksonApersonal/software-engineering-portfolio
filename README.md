# Software Engineering Portfolio

A production portfolio built with React, TypeScript, Vite, Tailwind CSS, Vercel Functions, and focused automated tests.

Live site: https://www.jacksonacord.dev/

## Projects

### Pathfinding Visualizer

An interactive grid for comparing BFS, Dijkstra, and A*. Visitors can place walls and weighted terrain, run animated searches, and compare step count with weighted traversal cost.

**Stack:** React, TypeScript, graph algorithms, Vitest

### URL Shortener

A production-verified full-stack URL shortener with validated destinations, cryptographically generated Base62 codes, durable Redis mappings, creation rate limiting, and server-side redirects.

**Stack:** React, TypeScript, Vercel Functions, Upstash Redis, Vitest

### Spotify Music Dashboard

A production-verified dashboard that uses server-side Spotify Authorization Code OAuth to display an authorized user's top artists and tracks across three listening periods. Tokens are stored in encrypted HttpOnly cookies and are never exposed to frontend code.

**Stack:** React, TypeScript, Spotify Web API, OAuth 2.0, Vercel Functions, Node crypto, Vitest

## Application Stack

- React 19 and React Router
- TypeScript
- Vite
- Tailwind CSS
- Vercel Functions using Web Standard `Request` and `Response`
- Upstash Redis for persistent short links and rate limiting
- Vitest and ESLint

## Local Development

Install dependencies:

```bash
npm install
```

Run the frontend development server:

```bash
npm run dev
```

Vite serves the React frontend. API-backed demos require the Vercel Functions and their environment variables; use Vercel's local development tooling when testing those endpoints locally.

## Environment Variables

The URL Shortener requires:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `SHORT_URL_ORIGIN`

The Spotify Music Dashboard requires:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI`
- `SPOTIFY_SESSION_SECRET` containing a securely generated 32-byte key encoded as Base64URL or hexadecimal

Production uses `https://www.jacksonacord.dev/api/spotify/callback` as the Spotify redirect URI. Local HTTP callbacks must use an explicit loopback address such as `127.0.0.1`, not `localhost`.

Never commit environment files or credential values.

## Validation

Run lint and automated tests:

```bash
npm run lint
npm test
```

Run the frontend, backend, and tooling TypeScript checks:

```bash
npx tsc -p tsconfig.app.json --noEmit
npx tsc -p tsconfig.api.json --noEmit
npx tsc -p tsconfig.node.json --noEmit
```

Create a production build:

```bash
npm run build
```

The test suite covers pathfinding models and algorithms, URL-shortening domain and API behavior, Redis adapter semantics, Spotify OAuth and session handling, frontend API clients, and Node ESM backend import compatibility.

## Deployment

The site is deployed to Vercel from the `main` branch.

- Files under `api/` deploy as Vercel Functions.
- `/s/:code` rewrites to the server-side URL redirect function.
- Remaining browser routes use the SPA fallback in `vercel.json`.
- Production environment variables are configured in Vercel and are not stored in the repository.
- The resume PDF and other static assets are served from `public/`.
