import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerErrorHandler } from "../../plugins/error-handler";
import { authRoutes } from "./auth.routes";
import { userService } from "./auth.service";
import { ConflictError, UnauthorizedError, BadRequestError } from "../../utils/errors/http.errors";

vi.mock("./auth.service", () => ({
  userService: {
    registerUser: vi.fn(),
    loginUser: vi.fn(),
    logoutUser: vi.fn(),
    getCurrentUser: vi.fn(),
    refreshToken: vi.fn(),
    revokeRefreshToken: vi.fn(),
    getUserByEmail: vi.fn(),
  },
}));

vi.mock("../../utils/auth/token", () => ({
  verifyAccessToken: vi.fn(),
}));

describe("Auth Routes", () => {
  let app: FastifyInstance;
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    createdAt: new Date(),
    updatedAt: new Date(),
    passwordHash: "hashed",
  };

  beforeEach(async () => {
    app = Fastify();
    await app.register(fastifyCookie, { secret: "test", hook: "onRequest" });
    await app.register(registerErrorHandler);
    await app.register(authRoutes);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /v1/auth/register", () => {
    it("registers new user successfully", async () => {
      (userService.registerUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: mockUser,
        accesToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
      });

      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/register",
        payload: {
          name: "Test User",
          email: "test@example.com",
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.user.email).toBe("test@example.com");
    });

    it("returns 400 for missing required fields", async () => {
      (userService.registerUser as ReturnType<typeof vi.fn>).mockRejectedValue(
        new BadRequestError("Name is required"),
      );

      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/register",
        payload: {
          email: "test@example.com",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 409 for duplicate email", async () => {
      (userService.registerUser as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ConflictError("Email already registered"),
      );

      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/register",
        payload: {
          name: "Test User",
          email: "existing@example.com",
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe("POST /v1/auth/login", () => {
    it("logs in user successfully", async () => {
      (userService.loginUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: mockUser,
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
      });

      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: {
          email: "test@example.com",
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it("returns 400 for missing credentials", async () => {
      (userService.loginUser as ReturnType<typeof vi.fn>).mockRejectedValue(
        new BadRequestError("Password is required"),
      );

      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: {
          email: "test@example.com",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 401 for invalid credentials", async () => {
      (userService.loginUser as ReturnType<typeof vi.fn>).mockRejectedValue(
        new UnauthorizedError("Invalid credentials"),
      );

      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: {
          email: "test@example.com",
          password: "wrongpassword",
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /v1/auth/me", () => {
    it("returns current user with valid token", async () => {
      (userService.getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: mockUser,
      });

      const response = await app.inject({
        method: "GET",
        url: "/v1/auth/me",
        cookies: { token: "valid-token" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.user.email).toBe("test@example.com");
    });

    it("returns 401 without token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/auth/me",
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 401 with invalid token", async () => {
      (userService.getCurrentUser as ReturnType<typeof vi.fn>).mockRejectedValue(
        new UnauthorizedError("Invalid token"),
      );

      const response = await app.inject({
        method: "GET",
        url: "/v1/auth/me",
        cookies: { token: "invalid-token" },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("DELETE /v1/auth/logout", () => {
    it("logs out user successfully", async () => {
      (userService.logoutUser as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
      (userService.revokeRefreshToken as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

      const response = await app.inject({
        method: "DELETE",
        url: "/v1/auth/logout",
        cookies: { token: "valid-token", refreshToken: "valid-refresh" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it("succeeds even without token (idempotent)", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/v1/auth/logout",
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe("POST /v1/auth/refresh", () => {
    it("refreshes tokens successfully", async () => {
      (userService.refreshToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: mockUser,
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
      });

      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/refresh",
        cookies: { refreshToken: "valid-refresh-token" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it("returns 401 without refresh token", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/refresh",
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 401 with invalid refresh token", async () => {
      (userService.refreshToken as ReturnType<typeof vi.fn>).mockRejectedValue(
        new UnauthorizedError("Invalid refresh token"),
      );

      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/refresh",
        cookies: { refreshToken: "invalid-token" },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
