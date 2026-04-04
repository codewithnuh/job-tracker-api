import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerErrorHandler } from "../../plugins/error-handler";
import { applicationRoutes } from "./applications.routes";
import { statsRoutes } from "../stats/stats.routes";
import { userService } from "../auth/auth.service";
import { applicationService } from "./applications.service";
import { BadRequestError } from "../../utils/errors/http.errors";

vi.mock("../auth/auth.service", () => ({
  userService: {
    getCurrentUser: vi.fn(),
  },
}));

vi.mock("./applications.service", () => ({
  applicationService: {
    createApplication: vi.fn(),
    getApplication: vi.fn(),
    getAllApplications: vi.fn(),
    updateApplication: vi.fn(),
    updateApplicationStatus: vi.fn(),
    deleteApplication: vi.fn(),
    getApplicationActivity: vi.fn(),
    getStats: vi.fn(),
  },
}));

describe("Application Routes", () => {
  let app: FastifyInstance;
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    createdAt: new Date(),
    updatedAt: new Date(),
    passwordHash: "hashed",
  };

  const mockApplication = {
    id: "app-456",
    userId: "user-123",
    companyName: "Tech Corp",
    roleTitle: "Software Engineer",
    status: "APPLIED" as const,
    location: "San Francisco, CA",
    jobUrl: "https://example.com/job/123",
    salaryMin: 100000,
    salaryMax: 150000,
    notes: "Test notes",
    appliedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    app = Fastify();
    await app.register(fastifyCookie, { secret: "test", hook: "onRequest" });
    await app.register(registerErrorHandler);
    await app.register(applicationRoutes);
    await app.register(statsRoutes);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /v1/applications", () => {
    it("creates application with valid data", async () => {
      (userService.getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: mockUser,
      });
      (applicationService.createApplication as ReturnType<typeof vi.fn>).mockResolvedValue(mockApplication);

      const response = await app.inject({
        method: "POST",
        url: "/v1/applications",
        cookies: { token: "valid-token" },
        payload: {
          companyName: "Tech Corp",
          roleTitle: "Software Engineer",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.companyName).toBe("Tech Corp");
    });

    it("returns 401 without auth token", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/applications",
        payload: {
          companyName: "Tech Corp",
          roleTitle: "Software Engineer",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 400 for missing required fields", async () => {
      (userService.getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: mockUser,
      });
      (applicationService.createApplication as ReturnType<typeof vi.fn>).mockRejectedValue(
        new BadRequestError("Company name is required"),
      );

      const response = await app.inject({
        method: "POST",
        url: "/v1/applications",
        cookies: { token: "valid-token" },
        payload: {
          companyName: "",
          roleTitle: "",
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /v1/applications", () => {
    it("returns all applications for authenticated user", async () => {
      (userService.getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: mockUser,
      });
      (applicationService.getAllApplications as ReturnType<typeof vi.fn>).mockResolvedValue([
        mockApplication,
        { ...mockApplication, id: "app-789", companyName: "Meta" },
      ]);

      const response = await app.inject({
        method: "GET",
        url: "/v1/applications",
        cookies: { token: "valid-token" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.meta.total).toBe(2);
    });

    it("returns 401 without auth token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/applications",
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns empty array when no applications", async () => {
      (userService.getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: mockUser,
      });
      (applicationService.getAllApplications as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const response = await app.inject({
        method: "GET",
        url: "/v1/applications",
        cookies: { token: "valid-token" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(0);
      expect(body.meta.total).toBe(0);
    });
  });

  describe("GET /v1/applications/:id", () => {
    it("returns single application", async () => {
      (userService.getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: mockUser,
      });
      (applicationService.getApplication as ReturnType<typeof vi.fn>).mockResolvedValue(mockApplication);

      const response = await app.inject({
        method: "GET",
        url: "/v1/applications/app-456",
        cookies: { token: "valid-token" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe("app-456");
    });

    it("returns 404 when application not found", async () => {
      (userService.getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: mockUser,
      });
      (applicationService.getApplication as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/v1/applications/nonexistent-id",
        cookies: { token: "valid-token" },
      });

      expect(response.statusCode).toBe(404);
    });

    it("returns 401 without auth token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/applications/app-456",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("PATCH /v1/applications/:id", () => {
    it("updates application fields", async () => {
      (userService.getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: mockUser,
      });
      const updatedApp = { ...mockApplication, companyName: "Updated Corp" };
      (applicationService.updateApplication as ReturnType<typeof vi.fn>).mockResolvedValue(updatedApp);

      const response = await app.inject({
        method: "PATCH",
        url: "/v1/applications/app-456",
        cookies: { token: "valid-token" },
        payload: { companyName: "Updated Corp" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.companyName).toBe("Updated Corp");
    });

    it("returns 401 without auth token", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/v1/applications/app-456",
        payload: { companyName: "Updated" },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("PATCH /v1/applications/:id/status", () => {
    it("updates application status", async () => {
      (userService.getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: mockUser,
      });
      const updatedApp = { ...mockApplication, status: "SCREENING" as const };
      (applicationService.updateApplicationStatus as ReturnType<typeof vi.fn>).mockResolvedValue(updatedApp);

      const response = await app.inject({
        method: "PATCH",
        url: "/v1/applications/app-456/status",
        cookies: { token: "valid-token" },
        payload: { status: "SCREENING", note: "Phone screen" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("SCREENING");
    });

    it("returns 401 without auth token", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/v1/applications/app-456/status",
        payload: { status: "SCREENING" },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("DELETE /v1/applications/:id", () => {
    it("deletes application", async () => {
      (userService.getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: mockUser,
      });
      (applicationService.deleteApplication as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

      const response = await app.inject({
        method: "DELETE",
        url: "/v1/applications/app-456",
        cookies: { token: "valid-token" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeNull();
    });

    it("returns 401 without auth token", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/v1/applications/app-456",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /v1/applications/:id/activity", () => {
    const mockActivityLogs = [
      {
        id: "log-1",
        applicationId: "app-456",
        fromStatus: null,
        toStatus: "APPLIED",
        note: "Application created",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "log-2",
        applicationId: "app-456",
        fromStatus: "APPLIED",
        toStatus: "SCREENING",
        note: "Phone screen scheduled",
        createdAt: "2024-01-02T00:00:00.000Z",
      },
    ];

    it("returns activity logs for application", async () => {
      (userService.getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: mockUser,
      });
      (applicationService.getApplicationActivity as ReturnType<typeof vi.fn>).mockResolvedValue(mockActivityLogs);

      const response = await app.inject({
        method: "GET",
        url: "/v1/applications/app-456/activity",
        cookies: { token: "valid-token" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].toStatus).toBe("APPLIED");
      expect(body.data[1].toStatus).toBe("SCREENING");
      expect(body.meta.total).toBe(2);
    });

    it("returns empty array when no activity logs", async () => {
      (userService.getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: mockUser,
      });
      (applicationService.getApplicationActivity as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const response = await app.inject({
        method: "GET",
        url: "/v1/applications/app-456/activity",
        cookies: { token: "valid-token" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(0);
      expect(body.meta.total).toBe(0);
    });

    it("returns 401 without auth token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/applications/app-456/activity",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /v1/stats", () => {
    const mockStats = {
      totalApplications: 5,
      byStatus: {
        APPLIED: 2,
        SCREENING: 1,
        INTERVIEW: 1,
        REJECTED: 1,
      },
    };

    it("returns job hunt statistics", async () => {
      (userService.getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: mockUser,
      });
      (applicationService.getStats as ReturnType<typeof vi.fn>).mockResolvedValue(mockStats);

      const response = await app.inject({
        method: "GET",
        url: "/v1/stats",
        cookies: { token: "valid-token" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.totalApplications).toBe(5);
      expect(body.data.byStatus.APPLIED).toBe(2);
      expect(body.data.byStatus.SCREENING).toBe(1);
    });

    it("returns zero counts when no applications", async () => {
      (userService.getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: mockUser,
      });
      (applicationService.getStats as ReturnType<typeof vi.fn>).mockResolvedValue({
        totalApplications: 0,
        byStatus: {},
      });

      const response = await app.inject({
        method: "GET",
        url: "/v1/stats",
        cookies: { token: "valid-token" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.totalApplications).toBe(0);
      expect(body.data.byStatus).toEqual({});
    });

    it("returns 401 without auth token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/stats",
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
