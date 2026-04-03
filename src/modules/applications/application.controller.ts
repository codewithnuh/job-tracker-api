import { FastifyRequest } from "fastify/types/request";
import {
  CreateApplicationType,
  UpdateApplicationType,
  UpdateApplicationStatusType,
} from "../../schemas/schema";
import { FastifyReply } from "fastify/types/reply";
import { applicationService } from "./applications.service";
import { createSuccessResponse } from "../../lib/response";
import { userService } from "../auth/auth.service";
import {
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from "../../utils/errors/http.errors";

type IdParams = { id: string };

class ApplicationController {
  // private async getAuthenticatedUser(request: FastifyRequest) {
  //   const token = request.cookies.token;
  //   if (!token) throw new UnauthorizedError("Please Login");
  //   const currentUser = await userService.getCurrentUser(token);
  //   if (!currentUser) throw new UnauthorizedError("Invalid or expired session");
  //   return currentUser.user;
  // }

  async create(
    request: FastifyRequest<{ Body: CreateApplicationType }>,
    reply: FastifyReply,
  ) {
    const token = request.cookies.token;
    if (!token) throw new UnauthorizedError("please authenticate");
    const { user } = await userService.getCurrentUser(token);
    const application = await applicationService.createApplication(
      user.id,
      request.body,
    );
    if (!application)
      throw new InternalServerError("Failed to create application");
    reply.code(201).send(
      createSuccessResponse({
        data: application,
        message: "Application Created Successfully",
        meta: null,
      }),
    );
  }

  async getAll(request: FastifyRequest, reply: FastifyReply) {
    const token = request.cookies.token;
    if (!token) throw new UnauthorizedError("please authenticate");
    const { user } = await userService.getCurrentUser(token);
    const applications = await applicationService.getAllApplications(user.id);
    reply.send(
      createSuccessResponse({
        data: applications,
        message: "Applications Retrieved Successfully",
        meta: { total: applications.length },
      }),
    );
  }

  async getOne(
    request: FastifyRequest<{ Params: IdParams }>,
    reply: FastifyReply,
  ) {
    const token = request.cookies.token;
    if (!token) throw new UnauthorizedError("please authenticate");
    const { user } = await userService.getCurrentUser(token);
    const { id } = request.params;
    const application = await applicationService.getApplication(id, user.id);
    if (!application) throw new NotFoundError("Application not found");
    reply.send(
      createSuccessResponse({
        data: application,
        message: "Application Retrieved Successfully",
        meta: null,
      }),
    );
  }

  async update(
    request: FastifyRequest<{
      Params: IdParams;
      Body: UpdateApplicationType;
    }>,
    reply: FastifyReply,
  ) {
    const token = request.cookies.token;
    if (!token) throw new UnauthorizedError("Please Authenticate");
    const { user } = await userService.getCurrentUser(token);
    const { id } = request.params;
    const body = request.body;
    const application = await applicationService.updateApplication(
      id,
      user.id,
      body,
    );
    if (!application)
      throw new InternalServerError("Failed to update application");
    reply.send(
      createSuccessResponse({
        data: application,
        message: "Application Updated Successfully",
        meta: null,
      }),
    );
  }

  async updateStatus(
    request: FastifyRequest<{
      Params: IdParams;
      Body: UpdateApplicationStatusType;
    }>,
    reply: FastifyReply,
  ) {
    const token = request.cookies.token;
    if (!token) throw new UnauthorizedError("Please Authenticate");
    const { user } = await userService.getCurrentUser(token);
    const { id } = request.params;
    const application = await applicationService.updateApplicationStatus(
      id,
      user.id,
      request.body,
    );
    if (!application)
      throw new InternalServerError("Failed to update application status");
    reply.send(
      createSuccessResponse({
        data: application,
        message: "Application Status Updated Successfully",
        meta: null,
      }),
    );
  }

  async delete(
    request: FastifyRequest<{ Params: IdParams }>,
    reply: FastifyReply,
  ) {
    const token = request.cookies.token;
    if (!token) throw new UnauthorizedError("Please Authenticate");
    const { user } = await userService.getCurrentUser(token);
    const { id } = request.params;
    await applicationService.deleteApplication(id, user.id);
    reply.send(
      createSuccessResponse({
        data: null,
        message: "Application Deleted Successfully",
        meta: null,
      }),
    );
  }
}

export const applicationController = new ApplicationController();
