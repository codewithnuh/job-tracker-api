import type { FastifyInstance } from "fastify";
import { handleError } from "../utils/errors/error.handler";

/**
 * Register global error handler for the Fastify instance.
 * @param fastify The Fastify instance to register the error handler on.
 */
export async function registerErrorHandler(fastify: FastifyInstance) {
  fastify.setErrorHandler((error, request, reply) => {
    // handleError now returns both the normalized internal error and the clean response
    const { normalized, response } = handleError(error);

    // LOG the FULL details to the server console for developers
    if (response.status_code >= 500) {
      request.log.error(
        { 
          err: error, 
          code: normalized.code, 
          details: normalized.details 
        }, 
        response.message
      );
    } else {
      // For 4xx errors, we use warn but still include the full details in the log
      request.log.warn(
        { 
          code: normalized.code, 
          details: normalized.details 
        }, 
        response.message
      );
    }

    // SEND the CLEAN (masked) response to the user for security
    return reply.status(response.status_code).send(response);
  });
}
