import Fastify from "fastify";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import fastifyCookie from "@fastify/cookie";
import { authMiddleware } from "./middleware/auth.middleware.js";
import { applicationRoutes } from "./modules/applications/applications.routes.js";
import { statsRoutes } from "./modules/stats/stats.routes.js";

export function buildApp() {
  const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

  const fastify = isServerless
    ? Fastify({ logger: { level: "warn" } })
    : Fastify({
        logger: {
          level: "info",
          transport: {
            target: "pino-pretty",
          },
        },
      });

  fastify.register(registerErrorHandler);

  fastify.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET as string,
    hook: "onRequest",
  });

  fastify.register(authRoutes);
  fastify.register(applicationRoutes);
  fastify.register(statsRoutes);

  fastify.get("/health", async () => {
    return { status: "OK" };
  });

  fastify.get(
    "/v1/protected-route",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      return {
        message: "You are in!",
        currentUser: request.user,
      };
    },
  );

  return fastify;
}

if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  const fastify = buildApp();
  const PORT = Number(process.env.PORT) || 3000;

  fastify.listen({ port: PORT, host: "0.0.0.0" }, function (err, address) {
    if (err) {
      fastify.log.error(err);
      process.exit(1);
    }
    fastify.log.info(`Server is now listening on ${address}`);
  });
}
