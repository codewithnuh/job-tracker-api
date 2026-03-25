import type { FastifyReply, FastifyRequest } from "fastify";
import { userService } from "./auth.service";
import { userType } from "../../schemas/schema";
import { verifyToken } from "../../utils/auth/token";
import { createSuccessResponse } from "../../lib/response";

class AuthController {
  async register(
    request: FastifyRequest<{ Body: userType }>,
    reply: FastifyReply,
  ) {
    const result = await userService.registerUser(request.body);

    return reply
      .status(201)
      .setCookie("token", result.token, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7200,
      })
      .send(
        createSuccessResponse({
          data: { user: result.user }, // Nested for consistency
          message: "User Registered Successfully",
          status_code: 201,
        }),
      );
  }

  async login(
    request: FastifyRequest<{ Body: userType }>,
    reply: FastifyReply,
  ) {
    const { email } = request.body;
    const existingToken = request.cookies?.token;

    if (existingToken) {
      const decoded = await verifyToken(existingToken);
      if (decoded && decoded.email === email) {
        const user = await userService.getUserByEmail(email);
        return reply.status(200).send(
          createSuccessResponse({
            data: { user }, // Standardized
            message: "Session is already active.",
          }),
        );
      }
    }

    const result = await userService.loginUser(request.body);

    return reply
      .setCookie("token", result.token, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7200,
      })
      .status(200)
      .send(
        createSuccessResponse({
          data: { user: result.user },
          message: "Login Successful",
        }),
      );
  }
}
export const authController = new AuthController();
// Bind methods to prevent 'this' issues with fastify
authController.register = authController.register.bind(authController);
authController.login = authController.login.bind(authController);
