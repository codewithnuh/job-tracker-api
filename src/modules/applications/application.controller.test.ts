import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FastifyRequest, FastifyReply } from "fastify";
import { applicationController } from "./application.controller";
import {
  UnauthorizedError,
  NotFoundError,
  InternalServerError,
} from "../../utils/errors/http.errors";
import {
  CreateApplicationType,
  UpdateApplicationType,
  UpdateApplicationStatusType,
} from "../../schemas/schema";

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
  },
}));

import { userService } from "../auth/auth.service";
import { applicationService } from "./applications.service";

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

function createMockRequest(overrides: Partial<{
  body: Record<string, unknown>;
  params: Record<string, string>;
  cookies: Record<string, string>;
}> = {}): any {
  return {
    body: { ...overrides.body },
    params: { ...overrides.params },
    cookies: { ...overrides.cookies },
  };
}

function createMockReply(): any {
  const reply: any = {
    statusCode: 200,
    sent: false,
    sentData: null,
  };
  
  reply.setCookie = vi.fn(function(this: any) { return this; });
  reply.clearCookie = vi.fn(function(this: any) { return this; });
  reply.status = vi.fn(function(this: any, code: number) { 
    this.statusCode = code; 
    return this; 
  });
  reply.code = vi.fn(function(this: any, code: number) { 
    this.statusCode = code; 
    return this; 
  });
  reply.send = vi.fn(function(this: any, data: any) {
    this.sent = true;
    this.sentData = data;
    return this;
  });
  
  return reply;
}

async function mockAuthSuccess() {
  (userService.getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: mockUser,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("applicationController.create", () => {
  it("returns 201 with created application", async () => {
    const mockRequest = createMockRequest({
      body: { companyName: "Tech Corp", roleTitle: "Engineer" },
      cookies: { token: "valid-token" },
    });
    const mockReply = createMockReply();
    
    await mockAuthSuccess();
    (applicationService.createApplication as ReturnType<typeof vi.fn>).mockResolvedValue(mockApplication);

    await applicationController.create(
      mockRequest as FastifyRequest<{ Body: CreateApplicationType }>,
      mockReply as FastifyReply,
    );

    expect(mockReply.statusCode).toBe(201);
    expect(mockReply.sent).toBe(true);
    expect(mockReply.sentData).toMatchObject({
      success: true,
      data: mockApplication,
      message: "Application Created Successfully",
    });
  });

  it("calls createApplication with correct userId", async () => {
    const mockRequest = createMockRequest({
      body: { companyName: "Google", roleTitle: "Developer" },
      cookies: { token: "valid-token" },
    });
    const mockReply = createMockReply();
    
    await mockAuthSuccess();
    (applicationService.createApplication as ReturnType<typeof vi.fn>).mockResolvedValue(mockApplication);

    await applicationController.create(
      mockRequest as FastifyRequest<{ Body: CreateApplicationType }>,
      mockReply as FastifyReply,
    );

    expect(applicationService.createApplication).toHaveBeenCalledWith(
      "user-123",
      expect.objectContaining({ companyName: "Google", roleTitle: "Developer" }),
    );
  });

  it("throws UnauthorizedError when no token provided", async () => {
    const mockRequest = createMockRequest({
      body: { companyName: "Test", roleTitle: "Dev" },
      cookies: {},
    });
    const mockReply = createMockReply();

    await expect(
      applicationController.create(
        mockRequest as FastifyRequest<{ Body: CreateApplicationType }>,
        mockReply as FastifyReply,
      ),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError when token is invalid", async () => {
    const mockRequest = createMockRequest({
      body: { companyName: "Test", roleTitle: "Dev" },
      cookies: { token: "invalid-token" },
    });
    const mockReply = createMockReply();

    (userService.getCurrentUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError("Invalid or expired session"),
    );

    await expect(
      applicationController.create(
        mockRequest as FastifyRequest<{ Body: CreateApplicationType }>,
        mockReply as FastifyReply,
      ),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws InternalServerError when createApplication returns null", async () => {
    const mockRequest = createMockRequest({
      body: { companyName: "Test", roleTitle: "Dev" },
      cookies: { token: "valid-token" },
    });
    const mockReply = createMockReply();

    await mockAuthSuccess();
    (applicationService.createApplication as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      applicationController.create(
        mockRequest as FastifyRequest<{ Body: CreateApplicationType }>,
        mockReply as FastifyReply,
      ),
    ).rejects.toThrow(InternalServerError);
  });
});

describe("applicationController.getAll", () => {
  it("returns 200 with all applications", async () => {
    const mockRequest = createMockRequest({
      cookies: { token: "valid-token" },
    });
    const mockReply = createMockReply();
    
    await mockAuthSuccess();
    (applicationService.getAllApplications as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockApplication,
      { ...mockApplication, id: "app-789", companyName: "Meta" },
    ]);

    await applicationController.getAll(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockReply.statusCode).toBe(200);
    expect(mockReply.sentData).toMatchObject({
      success: true,
      data: expect.any(Array),
      message: "Applications Retrieved Successfully",
      meta: { total: 2 },
    });
  });

  it("returns empty array when no applications exist", async () => {
    const mockRequest = createMockRequest({
      cookies: { token: "valid-token" },
    });
    const mockReply = createMockReply();
    
    await mockAuthSuccess();
    (applicationService.getAllApplications as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await applicationController.getAll(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockReply.sentData.meta.total).toBe(0);
  });

  it("throws UnauthorizedError when no token", async () => {
    const mockRequest = createMockRequest({ cookies: {} });
    const mockReply = createMockReply();

    await expect(
      applicationController.getAll(mockRequest as FastifyRequest, mockReply as FastifyReply),
    ).rejects.toThrow(UnauthorizedError);
  });
});

describe("applicationController.getOne", () => {
  it("returns 200 with single application", async () => {
    const mockRequest = createMockRequest({
      params: { id: "app-456" },
      cookies: { token: "valid-token" },
    });
    const mockReply = createMockReply();
    
    await mockAuthSuccess();
    (applicationService.getApplication as ReturnType<typeof vi.fn>).mockResolvedValue(mockApplication);

    await applicationController.getOne(
      mockRequest as FastifyRequest<{ Params: { id: string } }>,
      mockReply as FastifyReply,
    );

    expect(mockReply.statusCode).toBe(200);
    expect(mockReply.sentData).toMatchObject({
      success: true,
      data: mockApplication,
      message: "Application Retrieved Successfully",
    });
  });

  it("throws NotFoundError when application not found", async () => {
    const mockRequest = createMockRequest({
      params: { id: "nonexistent-id" },
      cookies: { token: "valid-token" },
    });
    const mockReply = createMockReply();
    
    await mockAuthSuccess();
    (applicationService.getApplication as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      applicationController.getOne(
        mockRequest as FastifyRequest<{ Params: { id: string } }>,
        mockReply as FastifyReply,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws UnauthorizedError when no token", async () => {
    const mockRequest = createMockRequest({
      params: { id: "app-123" },
      cookies: {},
    });
    const mockReply = createMockReply();

    await expect(
      applicationController.getOne(
        mockRequest as FastifyRequest<{ Params: { id: string } }>,
        mockReply as FastifyReply,
      ),
    ).rejects.toThrow(UnauthorizedError);
  });
});

describe("applicationController.update", () => {
  it("returns 200 with updated application", async () => {
    const mockRequest = createMockRequest({
      params: { id: "app-456" },
      body: { companyName: "Updated Corp", roleTitle: "Senior Engineer" },
      cookies: { token: "valid-token" },
    });
    const mockReply = createMockReply();
    
    await mockAuthSuccess();
    const updatedApp = { ...mockApplication, companyName: "Updated Corp" };
    (applicationService.updateApplication as ReturnType<typeof vi.fn>).mockResolvedValue(updatedApp);

    await applicationController.update(
      mockRequest as FastifyRequest<{ Params: { id: string }; Body: UpdateApplicationType }>,
      mockReply as FastifyReply,
    );

    expect(mockReply.statusCode).toBe(200);
    expect(mockReply.sentData).toMatchObject({
      success: true,
      message: "Application Updated Successfully",
    });
  });

  it("calls updateApplication with correct params", async () => {
    const mockRequest = createMockRequest({
      params: { id: "app-456" },
      body: { location: "Remote" },
      cookies: { token: "valid-token" },
    });
    const mockReply = createMockReply();
    
    await mockAuthSuccess();
    (applicationService.updateApplication as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockApplication,
      location: "Remote",
    });

    await applicationController.update(
      mockRequest as FastifyRequest<{ Params: { id: string }; Body: UpdateApplicationType }>,
      mockReply as FastifyReply,
    );

    expect(applicationService.updateApplication).toHaveBeenCalledWith(
      "app-456",
      "user-123",
      expect.objectContaining({ location: "Remote" }),
    );
  });

  it("throws UnauthorizedError when no token", async () => {
    const mockRequest = createMockRequest({
      params: { id: "app-456" },
      body: { companyName: "Test" },
      cookies: {},
    });
    const mockReply = createMockReply();

    await expect(
      applicationController.update(
        mockRequest as FastifyRequest<{ Params: { id: string }; Body: UpdateApplicationType }>,
        mockReply as FastifyReply,
      ),
    ).rejects.toThrow(UnauthorizedError);
  });
});

describe("applicationController.updateStatus", () => {
  it("returns 200 with status updated application", async () => {
    const mockRequest = createMockRequest({
      params: { id: "app-456" },
      body: { status: "SCREENING", note: "Phone screen scheduled" },
      cookies: { token: "valid-token" },
    });
    const mockReply = createMockReply();
    
    await mockAuthSuccess();
    const updatedApp = { ...mockApplication, status: "SCREENING" as const };
    (applicationService.updateApplicationStatus as ReturnType<typeof vi.fn>).mockResolvedValue(updatedApp);

    await applicationController.updateStatus(
      mockRequest as FastifyRequest<{ Params: { id: string }; Body: UpdateApplicationStatusType }>,
      mockReply as FastifyReply,
    );

    expect(mockReply.statusCode).toBe(200);
    expect(mockReply.sentData).toMatchObject({
      success: true,
      message: "Application Status Updated Successfully",
    });
  });

  it("calls updateApplicationStatus with correct params", async () => {
    const mockRequest = createMockRequest({
      params: { id: "app-456" },
      body: { status: "INTERVIEW" },
      cookies: { token: "valid-token" },
    });
    const mockReply = createMockReply();
    
    await mockAuthSuccess();
    (applicationService.updateApplicationStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockApplication,
      status: "INTERVIEW" as const,
    });

    await applicationController.updateStatus(
      mockRequest as FastifyRequest<{ Params: { id: string }; Body: UpdateApplicationStatusType }>,
      mockReply as FastifyReply,
    );

    expect(applicationService.updateApplicationStatus).toHaveBeenCalledWith(
      "app-456",
      "user-123",
      expect.objectContaining({ status: "INTERVIEW" }),
    );
  });

  it("throws UnauthorizedError when no token", async () => {
    const mockRequest = createMockRequest({
      params: { id: "app-456" },
      body: { status: "SCREENING" },
      cookies: {},
    });
    const mockReply = createMockReply();

    await expect(
      applicationController.updateStatus(
        mockRequest as FastifyRequest<{ Params: { id: string }; Body: UpdateApplicationStatusType }>,
        mockReply as FastifyReply,
      ),
    ).rejects.toThrow(UnauthorizedError);
  });
});

describe("applicationController.delete", () => {
  it("returns 200 on successful deletion", async () => {
    const mockRequest = createMockRequest({
      params: { id: "app-456" },
      cookies: { token: "valid-token" },
    });
    const mockReply = createMockReply();
    
    await mockAuthSuccess();
    (applicationService.deleteApplication as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    await applicationController.delete(
      mockRequest as FastifyRequest<{ Params: { id: string } }>,
      mockReply as FastifyReply,
    );

    expect(mockReply.statusCode).toBe(200);
    expect(mockReply.sentData).toMatchObject({
      success: true,
      data: null,
      message: "Application Deleted Successfully",
    });
  });

  it("calls deleteApplication with correct params", async () => {
    const mockRequest = createMockRequest({
      params: { id: "app-456" },
      cookies: { token: "valid-token" },
    });
    const mockReply = createMockReply();
    
    await mockAuthSuccess();
    (applicationService.deleteApplication as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    await applicationController.delete(
      mockRequest as FastifyRequest<{ Params: { id: string } }>,
      mockReply as FastifyReply,
    );

    expect(applicationService.deleteApplication).toHaveBeenCalledWith("app-456", "user-123");
  });

  it("throws UnauthorizedError when no token", async () => {
    const mockRequest = createMockRequest({
      params: { id: "app-456" },
      cookies: {},
    });
    const mockReply = createMockReply();

    await expect(
      applicationController.delete(
        mockRequest as FastifyRequest<{ Params: { id: string } }>,
        mockReply as FastifyReply,
      ),
    ).rejects.toThrow(UnauthorizedError);
  });
});
