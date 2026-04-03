import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import { registerErrorHandler } from "./error-handler";
import {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
} from "../utils/errors/http.errors";

describe("registerErrorHandler", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await app.register(registerErrorHandler);
  });

  afterEach(async () => {
    await app.close();
  });

  describe("setErrorHandler", () => {
    it("handles BadRequestError with 400 status", async () => {
      app.get("/bad-request", () => {
        throw new BadRequestError("Invalid input");
      });

      const response = await app.inject({
        method: "GET",
        url: "/bad-request",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("BAD_REQUEST");
    });

    it("handles UnauthorizedError with 401 status", async () => {
      app.get("/unauthorized", () => {
        throw new UnauthorizedError("Not authenticated");
      });

      const response = await app.inject({
        method: "GET",
        url: "/unauthorized",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("handles NotFoundError with 404 status", async () => {
      app.get("/not-found", () => {
        throw new NotFoundError("Resource not found");
      });

      const response = await app.inject({
        method: "GET",
        url: "/not-found",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("handles generic Error with 500 status", async () => {
      app.get("/generic-error", () => {
        throw new Error("Something went wrong");
      });

      const response = await app.inject({
        method: "GET",
        url: "/generic-error",
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
    });

    it("returns proper error response structure", async () => {
      app.get("/structured-error", () => {
        throw new BadRequestError("Test error");
      });

      const response = await app.inject({
        method: "GET",
        url: "/structured-error",
      });

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("success");
      expect(body).toHaveProperty("error");
      expect(body.error).toHaveProperty("code");
      expect(body.error).toHaveProperty("details");
    });

    it("masks internal error details in response", async () => {
      app.get("/internal-error", () => {
        throw new Error("Database connection failed - check logs");
      });

      const response = await app.inject({
        method: "GET",
        url: "/internal-error",
      });

      const body = JSON.parse(response.body);
      expect(body.error.details).toBe(
        "An unexpected error occurred. Please try again later.",
      );
    });
  });

  describe("setNotFoundHandler", () => {
    it("returns 404 for unknown routes", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/this-route-does-not-exist",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("includes method and url in 404 message", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/unknown/route",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("POST");
      expect(body.message).toContain("/unknown/route");
    });

    it("handles 404 for different HTTP methods", async () => {
      const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;

      for (const method of methods) {
        const response = await app.inject({
          method,
          url: "/non-existent",
        });

        expect(response.statusCode).toBe(404);
      }
    });

    it("returns proper error structure for 404", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/missing",
      });

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("success", false);
      expect(body).toHaveProperty("error");
      expect(body.error).toHaveProperty("code", "NOT_FOUND");
    });
  });
});
