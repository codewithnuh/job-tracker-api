import { FastifyInstance } from "fastify";
import { applicationController } from "./application.controller";
import {
  CreateApplicationType,
  UpdateApplicationType,
  UpdateApplicationStatusType,
} from "../../schemas/schema";

type IdParams = { id: string };

export async function applicationRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: CreateApplicationType }>(
    "/v1/applications",
    applicationController.create,
  );

  fastify.get("/v1/applications", applicationController.getAll);

  fastify.get<{ Params: IdParams }>(
    "/v1/applications/:id",
    applicationController.getOne,
  );

  fastify.get<{ Params: IdParams }>(
    "/v1/applications/:id/activity",
    applicationController.getActivity,
  );

  fastify.patch<{
    Params: IdParams;
    Body: UpdateApplicationType;
  }>("/v1/applications/:id", applicationController.update);

  fastify.patch<{
    Params: IdParams;
    Body: UpdateApplicationStatusType;
  }>("/v1/applications/:id/status", applicationController.updateStatus);

  fastify.delete<{ Params: IdParams }>(
    "/v1/applications/:id",
    applicationController.delete,
  );
}
