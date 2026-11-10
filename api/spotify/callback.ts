import {
  createSpotifyCallbackHandler,
  spotifyServiceUnavailableResponse,
} from '../_lib/spotifyHandlers.js';
import { loadSpotifyAuthConfig } from '../_lib/spotifyAuth.js';

let productionHandler: ((request: Request) => Promise<Response>) | undefined;

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      productionHandler ??= createSpotifyCallbackHandler({
        config: loadSpotifyAuthConfig(),
      });

      return await productionHandler(request);
    } catch {
      return spotifyServiceUnavailableResponse();
    }
  },
};
