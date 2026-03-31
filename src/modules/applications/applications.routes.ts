import { FastifyInstance } from "fastify";
import { applicationController } from "./application.controller";
import { CreateApplicationType } from "../../schemas/schema";

export async function applicationRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: CreateApplicationType }>(
    "/v1/application",
    applicationController.create,
  );
}
