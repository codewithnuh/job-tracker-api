import { FastifyInstance } from "fastify";
import { applicationController } from "../applications/application.controller";

export async function statsRoutes(fastify: FastifyInstance) {
  fastify.get("/v1/stats", applicationController.getStats);
}
