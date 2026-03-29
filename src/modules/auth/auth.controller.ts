import type { FastifyReply, FastifyRequest } from "fastify";
import { userService } from "./auth.service";
import { userType } from "../../schemas/schema";
import { verifyAccessToken } from "../../utils/auth/token";
import { createSuccessResponse } from "../../lib/response";
import { UnauthorizedError } from "../../utils/errors/http.errors";

class AuthController {
  async register(
    request: FastifyRequest<{ Body: userType }>,
    reply: FastifyReply,
  ) {
    const result = await userService.registerUser(request.body);

    return reply
      .status(201)
      .setCookie("token", result.accesToken, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7200,
      })
      .setCookie("refreshToken", result.refreshToken, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 604800,
      })
      .send(
        createSuccessResponse({
          data: { user: result.user },
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
      try {
        const decoded = await verifyAccessToken(existingToken);
        if (decoded?.email === email) {
          const result = await userService.getUserByEmail(email);
          return reply.status(200).send(
            createSuccessResponse({
              data: { user: result.user },
              message: "Session is already active.",
            }),
          );
        }
      } catch {
        // Token invalid, proceed to login
      }
    }

    const result = await userService.loginUser(request.body);

    return reply
      .setCookie("token", result.accessToken, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7200,
      })
      .setCookie("refreshToken", result.refreshToken, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 604800,
      })
      .status(200)
      .send(
        createSuccessResponse({
          data: { user: result.user },
          message: "Login Successful",
        }),
      );
  }
  async logout(request: FastifyRequest, reply: FastifyReply) {
    const accessToken = request.cookies?.token;
    const refreshToken = request.cookies?.refreshToken;

    if (accessToken) {
      await userService.logoutUser(accessToken);
    }

    if (refreshToken) {
      await userService.revokeRefreshToken(refreshToken);
    }

    return reply
      .clearCookie("token", {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      })
      .clearCookie("refreshToken", {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      })
      .status(200)
      .send(
        createSuccessResponse({
          message: "Logged out successfully",
        }),
      );
  }

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    const refreshToken = request.cookies?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedError("No refresh token provided");
    }

    const result = await userService.refreshToken(refreshToken);

    return reply
      .setCookie("token", result.accessToken, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7200,
      })
      .setCookie("refreshToken", result.refreshToken, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 604800,
      })
      .status(200)
      .send(
        createSuccessResponse({
          data: { user: result.user },
          message: "Token refreshed successfully",
        }),
      );
  }
  async getCurrentUser(request: FastifyRequest, reply: FastifyReply) {
    const token = request.cookies?.token;

    if (!token) {
      throw new UnauthorizedError("No authentication token provided");
    }

    const result = await userService.getCurrentUser(token);

    return reply.status(200).send(
      createSuccessResponse({
        data: { user: result.user },
        message: "User retrieved successfully",
      }),
    );
  }
}

export const authController = new AuthController();

authController.register = authController.register.bind(authController);
authController.login = authController.login.bind(authController);
authController.logout = authController.logout.bind(authController);
authController.refresh = authController.refresh.bind(authController);
authController.getCurrentUser =
  authController.getCurrentUser.bind(authController);
