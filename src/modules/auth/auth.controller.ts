import type { FastifyReply, FastifyRequest } from "fastify";
import { userService } from "./auth.service";
import { userType } from "../../schemas/schema";

class AuthController {
  /**
   * Register a new user
   */
  async register(
    request: FastifyRequest<{ Body: userType }>,
    reply: FastifyReply,
  ) {
    const result = await userService.registerUser(request.body);
    return reply.status(201).send(result);
  }

  /**
   * Login a user
   */
  async login(
    request: FastifyRequest<{ Body: userType }>,
    reply: FastifyReply,
  ) {
    const result = await userService.loginUser(request.body);
    return reply.status(200).send(result);
  }
}

export const authController = new AuthController();
// Bind methods to prevent 'this' issues with fastify
authController.register = authController.register.bind(authController);
authController.login = authController.login.bind(authController);
