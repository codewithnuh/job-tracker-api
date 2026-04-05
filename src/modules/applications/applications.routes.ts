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
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute",
        },
      },
    },
    applicationController.create,
  );

  fastify.get(
    "/v1/applications",
    {
      config: {
        rateLimit: {
          max: 100,
          timeWindow: "1 minute",
        },
      },
    },
    applicationController.getAll,
  );

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
  }>(
    "/v1/applications/:id",
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
        },
      },
    },
    applicationController.update,
  );

  fastify.patch<{
    Params: IdParams;
    Body: UpdateApplicationStatusType;
  }>(
    "/v1/applications/:id/status",
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
        },
      },
    },
    applicationController.updateStatus,
  );

  fastify.delete<{ Params: IdParams }>(
    "/v1/applications/:id",
    applicationController.delete,
  );
}
