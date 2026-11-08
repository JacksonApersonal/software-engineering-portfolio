import {
  createRedirectHandler,
  serviceUnavailableResponse,
} from './_lib/handlers.js';
import { createProductionStore } from './_lib/upstash.js';

let productionHandler: ((request: Request) => Promise<Response>) | undefined;

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      productionHandler ??= createRedirectHandler({
        store: createProductionStore(),
      });

      return await productionHandler(request);
    } catch {
      return serviceUnavailableResponse();
    }
  },
};
