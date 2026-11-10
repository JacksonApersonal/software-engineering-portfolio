import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const productionModules = [
  new URL('../shorten.ts', import.meta.url),
  new URL('../redirect.ts', import.meta.url),
  new URL('./handlers.ts', import.meta.url),
  new URL('./upstash.ts', import.meta.url),
  new URL('./spotifyAuth.ts', import.meta.url),
  new URL('./spotifyHandlers.ts', import.meta.url),
  new URL('../spotify/login.ts', import.meta.url),
  new URL('../spotify/callback.ts', import.meta.url),
  new URL('../spotify/dashboard.ts', import.meta.url),
  new URL('../spotify/logout.ts', import.meta.url),
  new URL('../../src/lib/urlShortener.ts', import.meta.url),
];

describe('production backend imports', () => {
  it('uses Node ESM-compatible extensions for every relative import', async () => {
    for (const moduleUrl of productionModules) {
      const source = await readFile(moduleUrl, 'utf8');
      const relativeImports = source.matchAll(
        /(?:from\s+|import\s*)['"](\.{1,2}\/[^'"]+)['"]/g,
      );

      for (const [, specifier] of relativeImports) {
        expect(specifier, `${moduleUrl.pathname} has an unsafe import`).toMatch(
          /\.js$/,
        );
      }
    }
  });
});
