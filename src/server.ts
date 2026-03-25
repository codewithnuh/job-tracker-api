import Fastify from "fastify";
import "dotenv/config";
import { registerErrorHandler } from "./plugins/error-handler";
import { authRoutes } from "./modules/auth/auth.routes";
import fastifyCookie from "@fastify/cookie";
const fastify = Fastify({
  logger: {
    level: "info",
    transport: {
      target: "pino-pretty",
    },
  },
});

// Setup Global Error Handler
// Note: We're not using .register() here to keep it in the global scope without fastify-plugin
fastify.register(registerErrorHandler);

fastify.register(fastifyCookie, {
  secret: process.env.COOKIE_SECRET as string,
  hook: "onRequest",
});
// Register routes
fastify.register(authRoutes);
// Simple health check
fastify.get("/health", async () => {
  return { status: "OK" };
});

const PORT = Number(process.env.PORT) || 3000;

// Run the server!
fastify.listen({ port: PORT, host: "0.0.0.0" }, function (err, address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`Server is now listening on ${address}`);
});
