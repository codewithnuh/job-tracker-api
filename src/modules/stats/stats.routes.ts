import { FastifyInstance } from "fastify";
import { applicationController } from "../applications/application.controller.js";

export async function statsRoutes(fastify: FastifyInstance) {
  fastify.get("/v1/stats", applicationController.getStats);
}
