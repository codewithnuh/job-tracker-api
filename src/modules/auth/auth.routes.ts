import type { FastifyInstance } from "fastify";
import { authController } from "./auth.controller";
import { userType } from "../../schemas/schema";

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: userType }>(
    "/v1/auth/register",
    authController.register,
  );
  fastify.post<{ Body: userType }>(
    "/v1/auth/login",
    authController.login,
  );
}
