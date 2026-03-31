import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { randomUUID } from "crypto";

import { db } from "../../db/index";
import { applications, users } from "../../db/schema";
import { applicationService } from "./applications.service";

import {
  UnauthorizedError,
  NotFoundError,
  BadRequestError,
} from "../../utils/errors/http.errors";

import { userService } from "../auth/auth.service";

vi.mock("../auth/auth.service", () => ({
  userService: {
    getCurrentUser: vi.fn(),
  },
}));

let testUserId: string;

//
// Reset database + create fresh user per test
//
beforeEach(async () => {
  await db.delete(applications);
  await db.delete(users);

  vi.clearAllMocks();
  vi.restoreAllMocks();

  const [createdUser] = await db
    .insert(users)
    .values({
      name: "Test User",
      email: `test-${randomUUID()}@example.com`,
      passwordHash: "hashed",
    })
    .returning();

  if (!createdUser) {
    throw new Error("Failed to create test user");
  }

  testUserId = createdUser.id;
});

afterAll(async () => {
  await db.delete(applications);
  await db.delete(users);
});

//
// CREATE APPLICATION
//
describe("createApplication", () => {
  it("creates a new application with minimum required fields", async () => {
    const app = await applicationService.createApplication(testUserId, {
      companyName: "Google",
      roleTitle: "Frontend Engineer",
    });

    expect(app.id).toBeDefined();
    expect(app.userId).toBe(testUserId);
    expect(app.companyName).toBe("Google");
    expect(app.roleTitle).toBe("Frontend Engineer");
    expect(app.status).toBe("APPLIED");
    expect(app.appliedAt).toBeDefined();
    expect(app.createdAt).toBeDefined();
  });

  it("creates an application with all optional fields", async () => {
    const app = await applicationService.createApplication(testUserId, {
      companyName: "Meta",
      roleTitle: "Product Designer",
      location: "London, UK",
      jobUrl: "https://careers.meta.com/jobs/123",
      salaryMin: 50000,
      salaryMax: 70000,
      notes: "Referred by friend",
      status: "INTERVIEW",
    });

    expect(app.location).toBe("London, UK");
    expect(app.jobUrl).toBe("https://careers.meta.com/jobs/123");
    expect(app.salaryMin).toBe(50000);
    expect(app.salaryMax).toBe(70000);
    expect(app.notes).toBe("Referred by friend");
    expect(app.status).toBe("INTERVIEW");
  });

  it("creates application using token", async () => {
    vi.mocked(userService.getCurrentUser).mockResolvedValue({
      user: {
        id: testUserId,
        name: "Test",
        email: "test@example.com",
        createdAt: new Date(),
      },
    });

    const app = await applicationService.createApplication("valid-token", {
      companyName: "Netflix",
      roleTitle: "Backend Engineer",
    });

    expect(app.companyName).toBe("Netflix");
    expect(app.userId).toBe(testUserId);
  });

  it("throws UnauthorizedError for invalid token", async () => {
    vi.mocked(userService.getCurrentUser).mockRejectedValue(
      new UnauthorizedError("Invalid token"),
    );

    await expect(
      applicationService.createApplication("invalid-token", {
        companyName: "Tesla",
        roleTitle: "Engineer",
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws BadRequestError if required fields are missing", async () => {
    await expect(
      applicationService.createApplication(testUserId, {
        companyName: "",
        roleTitle: "",
      }),
    ).rejects.toThrow(BadRequestError);
  });

  it("throws BadRequestError if userId is missing", async () => {
    await expect(
      applicationService.createApplication(testUserId, {
        companyName: "Tesla",
        roleTitle: "Engineer",
      }),
    ).rejects.toThrow(BadRequestError);
  });

  it("throws BadRequestError if status is invalid", async () => {
    await expect(
      applicationService.createApplication(testUserId, {
        companyName: "Tesla",
        roleTitle: "Engineer",
        // @ts-ignore
        status: "INVALID_STATUS",
      }),
    ).rejects.toThrow(BadRequestError);
  });
});

//
// GET APPLICATION
//
describe("getApplication", () => {
  it("returns application when found and user owns it", async () => {
    const created = await applicationService.createApplication(testUserId, {
      companyName: "GetTest",
      roleTitle: "Developer",
    });

    const app = await applicationService.getApplication(created.id, testUserId);

    expect(app.id).toBe(created.id);
    expect(app.companyName).toBe("GetTest");
  });

  it("throws NotFoundError when application does not exist", async () => {
    await expect(
      applicationService.getApplication(
        "00000000-0000-0000-0000-000000000000",
        testUserId,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws UnauthorizedError when user does not own application", async () => {
    const created = await applicationService.createApplication(testUserId, {
      companyName: "OtherUser",
      roleTitle: "Developer",
    });

    await expect(
      applicationService.getApplication(
        created.id,
        "00000000-0000-0000-0000-000000000001",
      ),
    ).rejects.toThrow(UnauthorizedError);
  });
});

//
// GET ALL
//
describe("getAllApplications", () => {
  it("returns all applications for user", async () => {
    await applicationService.createApplication(testUserId, {
      companyName: "Company A",
      roleTitle: "Dev A",
    });

    await applicationService.createApplication(testUserId, {
      companyName: "Company B",
      roleTitle: "Dev B",
    });

    const apps = await applicationService.getAllApplications(testUserId);

    expect(apps.length).toBe(2);
  });

  it("returns empty array when no applications exist", async () => {
    const apps = await applicationService.getAllApplications(testUserId);

    expect(apps).toEqual([]);
  });
});

//
// UPDATE STATUS
//
describe("updateApplicationStatus", () => {
  it("updates status with valid transition", async () => {
    const created = await applicationService.createApplication(testUserId, {
      companyName: "UpdateTest",
      roleTitle: "Developer",
    });

    const updated = await applicationService.updateApplicationStatus(
      created.id,
      testUserId,
      { status: "SCREENING" },
    );

    expect(updated.status).toBe("SCREENING");
  });

  it("throws NotFoundError when application does not exist", async () => {
    await expect(
      applicationService.updateApplicationStatus(
        "00000000-0000-0000-0000-000000000000",
        testUserId,
        { status: "SCREENING" },
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws UnauthorizedError when user does not own application", async () => {
    const created = await applicationService.createApplication(testUserId, {
      companyName: "OtherApp",
      roleTitle: "Developer",
    });

    await expect(
      applicationService.updateApplicationStatus(
        created.id,
        "00000000-0000-0000-0000-000000000001",
        { status: "SCREENING" },
      ),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws BadRequestError for invalid transition", async () => {
    const created = await applicationService.createApplication(testUserId, {
      companyName: "TransitionTest",
      roleTitle: "Developer",
    });

    await expect(
      applicationService.updateApplicationStatus(created.id, testUserId, {
        status: "ACCEPTED",
      }),
    ).rejects.toThrow(BadRequestError);
  });
});

//
// DELETE
//
describe("deleteApplication", () => {
  it("deletes application when user owns it", async () => {
    const created = await applicationService.createApplication(testUserId, {
      companyName: "DeleteTest",
      roleTitle: "Developer",
    });

    const result = await applicationService.deleteApplication(
      created.id,
      testUserId,
    );

    expect(result.success).toBe(true);

    await expect(
      applicationService.getApplication(created.id, testUserId),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError when application does not exist", async () => {
    await expect(
      applicationService.deleteApplication(
        "00000000-0000-0000-0000-000000000000",
        testUserId,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws UnauthorizedError when user does not own application", async () => {
    const created = await applicationService.createApplication(testUserId, {
      companyName: "OtherDelete",
      roleTitle: "Developer",
    });

    await expect(
      applicationService.deleteApplication(
        created.id,
        "00000000-0000-0000-0000-000000000001",
      ),
    ).rejects.toThrow(UnauthorizedError);
  });
});
