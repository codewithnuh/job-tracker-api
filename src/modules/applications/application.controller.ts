import { FastifyRequest } from "fastify/types/request";
import { CreateApplicationType } from "../../schemas/schema";
import { FastifyReply } from "fastify/types/reply";
import { applicationService } from "./applications.service";
import { createSuccessResponse } from "../../lib/response";
import { serialize } from "v8";
import { userService } from "../auth/auth.service";
import {
  InternalServerError,
  UnauthorizedError,
} from "../../utils/errors/http.errors";

class ApplicationController {
  async create(
    request: FastifyRequest<{ Body: CreateApplicationType }>,
    reply: FastifyReply,
  ) {
    const token = request.cookies.token;
    if (!token) throw new UnauthorizedError("Please Login");
    const currentUser = await userService.getCurrentUser(token);
    if (!currentUser) throw new UnauthorizedError("Invalid or expired session");
    const application = await applicationService.createApplication(
      currentUser.user.id,
      request.body,
    );
    if (!application)
      throw new InternalServerError("Failed to create application");
    reply.send(
      createSuccessResponse({
        data: application,
        message: "Application Created Successfully",
        meta: null,
        status_code: 201,
      }),
    );
  }
}
export const applicationController = new ApplicationController();
