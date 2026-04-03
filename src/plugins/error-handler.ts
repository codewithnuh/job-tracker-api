import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { handleError } from "../utils/errors/error.handler";
import { NotFoundError } from "../utils/errors/http.errors";

export const registerErrorHandler = fp(async function (
  fastify: FastifyInstance,
) {
  fastify.setErrorHandler((error, request, reply) => {
    const { normalized, response } = handleError(error);

    if (response.status_code >= 500) {
      request.log.error(error);
    } else {
      request.log.warn(normalized.message);
    }

    return reply.status(response.status_code).send(response);
  });

  fastify.setNotFoundHandler((request, reply) => {
    const notFoundError = new NotFoundError(
      `Route ${request.method} ${request.url} not found`,
    );
    const { response } = handleError(notFoundError);

    reply.status(404).send(response);
  });
});
