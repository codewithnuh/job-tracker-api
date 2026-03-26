import fp from "fastify-plugin"; // Install with: npm install fastify-plugin
import type { FastifyInstance } from "fastify";
import { handleError } from "../utils/errors/error.handler";

// Wrap the function in fp()
export const registerErrorHandler = fp(async function (
  fastify: FastifyInstance,
) {
  fastify.setErrorHandler((error, request, reply) => {
    const { normalized, response } = handleError(error);

    // Standardized Logging
    if (response.status_code >= 500) {
      request.log.error(error);
    } else {
      request.log.warn(normalized.message);
    }

    // This will now send your createErrorResponse format globally
    return reply.status(response.status_code).send(response);
  });

  // Also handle 404s for routes that don't exist
  fastify.setNotFoundHandler((request, reply) => {
    const { response } = handleError({
      statusCode: 404,
      message: `Route ${request.method} ${request.url} not found`,
      code: "NOT_FOUND",
    });
    reply.status(404).send(response);
  });
});
