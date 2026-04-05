import fp from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import { createErrorResponse } from "../lib/response";

declare module "@fastify/rate-limit" {
  interface RateLimitOptions {
    global?: boolean;
  }
}

export const registerRateLimit = fp(async function (fastify: FastifyInstance) {
  fastify.register(rateLimit, {
    global: false,
    max: 100,
    timeWindow: "1 minute",
    errorResponseBuilder: function (request, context) {
      return createErrorResponse({
        status_code: 429,
        message: "Too many requests",
        code: "RATE_LIMIT_EXCEEDED",
        details: `You have exceeded the ${context.max} requests in ${context.after} limit!`,
      });
    },
    onExceeding: function (request, key) {
      request.log.warn(`Rate limit approaching for key: ${key}`);
    },
    onExceeded: function (request, key) {
      request.log.warn(`Rate limit exceeded for key: ${key}`);
    },
  });
});

export const registerStrictRateLimit = fp(async function (fastify: FastifyInstance) {
  fastify.register(rateLimit, {
    global: false,
    max: 5,
    timeWindow: "1 minute",
    errorResponseBuilder: function (request, context) {
      return createErrorResponse({
        status_code: 429,
        message: "Too many requests",
        code: "RATE_LIMIT_EXCEEDED",
        details: `You have exceeded the ${context.max} requests in ${context.after} limit!`,
      });
    },
    onExceeding: function (request, key) {
      request.log.warn(`Strict rate limit approaching for key: ${key}`);
    },
    onExceeded: function (request, key) {
      request.log.error(`Strict rate limit exceeded for key: ${key}`);
    },
  });
});
