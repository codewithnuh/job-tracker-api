import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerErrorHandler } from "./plugins/error-handler";

vi.mock("./modules/auth/auth.routes", () => ({
  authRoutes: vi.fn(async (fastify: FastifyInstance) => {
    fastify.post("/test-register", async () => ({ registered: true }));
    fastify.post("/test-login", async () => ({ loggedIn: true }));
  }),
}));

vi.mock("./middleware/auth.middleware", () => ({
  authMiddleware: vi.fn(),
}));

vi.mock("@fastify/cookie", () => ({
  default: vi.fn().mockImplementation(() => async () => {}),
}));

describe("Server Configuration", () => {
  describe("Fastify instance", () => {
    it("creates Fastify instance with logger", async () => {
      const fastify = Fastify({
        logger: {
          level: "info",
        },
      });

      expect(fastify).toBeDefined();
      expect(typeof fastify.listen).toBe("function");

      await fastify.close();
    });

    it("registers error handler plugin", async () => {
      const fastify = Fastify();
      await fastify.register(registerErrorHandler);

      fastify.get("/test-error", () => {
        throw new Error("Test error");
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/test-error",
      });

      expect(response.statusCode).toBe(500);

      await fastify.close();
    });
  });

  describe("Health check endpoint", () => {
    it("returns OK status", async () => {
      const fastify = Fastify();
      
      fastify.get("/health", async () => {
        return { status: "OK" };
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe("OK");

      await fastify.close();
    });
  });

  describe("Cookie plugin", () => {
    it("can register cookie plugin", async () => {
      const fastify = Fastify();
      
      await fastify.register(fastifyCookie, {
        secret: "test-secret",
        hook: "onRequest",
      });

      expect(fastify).toBeDefined();

      await fastify.close();
    });
  });

  describe("Protected route", () => {
    it("handles protected route with auth middleware", async () => {
      const fastify = Fastify();
      const authMiddleware = vi.fn(async (request: any) => {
        request.user = { id: "test-user" };
      });

      fastify.get(
        "/protected",
        { preHandler: [authMiddleware] },
        async (request: any) => {
          return {
            message: "You are in!",
            currentUser: request.user,
          };
        },
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/protected",
      });

      expect(response.statusCode).toBe(200);
      expect(authMiddleware).toHaveBeenCalled();

      await fastify.close();
    });
  });

  describe("Port configuration", () => {
    it("uses PORT from environment or default", () => {
      const originalPort = process.env.PORT;
      
      delete process.env.PORT;
      const defaultPort = Number(process.env.PORT) || 3000;
      expect(defaultPort).toBe(3000);

      process.env.PORT = "8080";
      const customPort = Number(process.env.PORT) || 3000;
      expect(customPort).toBe(8080);

      if (originalPort !== undefined) {
        process.env.PORT = originalPort;
      }
    });
  });

  describe("404 handling", () => {
    it("returns 404 for unknown routes", async () => {
      const fastify = Fastify();
      await fastify.register(registerErrorHandler);

      const response = await fastify.inject({
        method: "GET",
        url: "/unknown-route",
      });

      expect(response.statusCode).toBe(404);

      await fastify.close();
    });
  });
});

describe("Route registration", () => {
  it("can register auth routes via mock", async () => {
    const fastify = Fastify();
    
    const mockAuthRoutes = vi.fn(async (f: FastifyInstance) => {
      f.post("/test-register", async () => ({ registered: true }));
    });

    await fastify.register(mockAuthRoutes);

    const testResponse = await fastify.inject({
      method: "POST",
      url: "/test-register",
    });

    expect(testResponse.statusCode).toBe(200);

    await fastify.close();
  });
});
