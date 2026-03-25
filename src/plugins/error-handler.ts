import type { FastifyInstance } from "fastify";
import { handleError } from "../utils/errors/error.handler"; // Ensure path is correct

export async function registerErrorHandler(fastify: FastifyInstance) {
  fastify.setErrorHandler((error, request, reply) => {
    const { normalized, response } = handleError(error);

    // Standardized Logging
    if (response.status_code >= 500) {
      request.log.error(error);
    } else {
      request.log.warn(normalized.message);
    }

    return reply.status(response.status_code).send(response);
  });
}
