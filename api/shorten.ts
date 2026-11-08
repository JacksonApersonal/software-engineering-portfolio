import {
  createShortenHandler,
  serviceUnavailableResponse,
} from './_lib/handlers.js';
import {
  createProductionShortenDependencies,
  getClientIdentifier,
} from './_lib/upstash.js';

let productionHandler: ((request: Request) => Promise<Response>) | undefined;

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      productionHandler ??= createShortenHandler({
        ...createProductionShortenDependencies(),
        getClientIdentifier,
      });

      return await productionHandler(request);
    } catch {
      return serviceUnavailableResponse();
    }
  },
};
