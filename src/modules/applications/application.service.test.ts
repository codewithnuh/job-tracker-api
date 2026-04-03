import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomUUID } from "crypto";

import { db } from "../../db/index";
import { applications, users, activityLogs } from "../../db/schema";
import { applicationService } from "./applications.service";

import {
  UnauthorizedError,
  NotFoundError,
  BadRequestError,
} from "../../utils/errors/http.errors";

let testUserId: string;
let otherUserId: string;

beforeEach(async () => {
  await db.delete(activityLogs);
  await db.delete(applications);
  await db.delete(users);

  const [createdUser] = await db
    .insert(users)
    .values({
      name: "Test User",
      email: `test-${randomUUID()}@example.com`,
      passwordHash: "hashed",
    })
    .returning();

  testUserId = createdUser!.id;

  const [otherUser] = await db
    .insert(users)
    .values({
      name: "Other User",
      email: `other-${randomUUID()}@example.com`,
      passwordHash: "hashed",
    })
    .returning();

  otherUserId = otherUser!.id;
});

afterEach(async () => {
  await db.delete(activityLogs);
  await db.delete(applications);
  await db.delete(users);
});

describe("ApplicationService", () => {
  describe("createApplication", () => {
    it("should create application with required fields only", async () => {
      const app = await applicationService.createApplication(testUserId, {
        companyName: "Google",
        roleTitle: "Frontend Engineer",
      });

      expect(app.id).toBeDefined();
      expect(app.userId).toBe(testUserId);
      expect(app.companyName).toBe("Google");
      expect(app.roleTitle).toBe("Frontend Engineer");
      expect(app.status).toBe("APPLIED");
    });

    it("should create application with all optional fields", async () => {
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

    it("should throw BadRequestError for empty company name", async () => {
      await expect(
        applicationService.createApplication(testUserId, {
          companyName: "",
          roleTitle: "Developer",
        }),
      ).rejects.toThrow(BadRequestError);
    });

    it("should throw BadRequestError for empty role title", async () => {
      await expect(
        applicationService.createApplication(testUserId, {
          companyName: "Google",
          roleTitle: "",
        }),
      ).rejects.toThrow(BadRequestError);
    });

    it("should throw BadRequestError for invalid status", async () => {
      await expect(
        applicationService.createApplication(testUserId, {
          companyName: "Google",
          roleTitle: "Developer",
          // @ts-expect-error Testing invalid status
          status: "INVALID_STATUS",
        }),
      ).rejects.toThrow(BadRequestError);
    });

    it("should throw BadRequestError when userId is empty", async () => {
      await expect(
        applicationService.createApplication("", {
          companyName: "Google",
          roleTitle: "Developer",
        }),
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe("getApplication", () => {
    it("should return application when found and user owns it", async () => {
      const created = await applicationService.createApplication(testUserId, {
        companyName: "Test Company",
        roleTitle: "Developer",
      });

      const app = await applicationService.getApplication(created.id, testUserId);

      expect(app.id).toBe(created.id);
      expect(app.companyName).toBe("Test Company");
    });

    it("should throw NotFoundError when application does not exist", async () => {
      await expect(
        applicationService.getApplication(
          "00000000-0000-0000-0000-000000000000",
          testUserId,
        ),
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw UnauthorizedError when user does not own application", async () => {
      const created = await applicationService.createApplication(testUserId, {
        companyName: "Other Company",
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

  describe("getAllApplications", () => {
    it("should return all applications for user", async () => {
      await applicationService.createApplication(testUserId, {
        companyName: "Company A",
        roleTitle: "Dev A",
      });

      await applicationService.createApplication(testUserId, {
        companyName: "Company B",
        roleTitle: "Dev B",
      });

      const apps = await applicationService.getAllApplications(testUserId);

      expect(apps).toHaveLength(2);
    });

    it("should return empty array when no applications exist", async () => {
      const apps = await applicationService.getAllApplications(testUserId);
      expect(apps).toEqual([]);
    });

    it("should NOT return other users applications", async () => {
      await applicationService.createApplication(testUserId, {
        companyName: "My Company",
        roleTitle: "Developer",
      });

      await applicationService.createApplication(otherUserId, {
        companyName: "Other Company",
        roleTitle: "Developer",
      });

      const apps = await applicationService.getAllApplications(testUserId);
      expect(apps).toHaveLength(1);
      expect(apps[0]!.companyName).toBe("My Company");
    });
  });

  describe("updateApplication", () => {
    it("should update application fields", async () => {
      const created = await applicationService.createApplication(testUserId, {
        companyName: "Old Company",
        roleTitle: "Junior Dev",
      });

      const updated = await applicationService.updateApplication(
        created.id,
        testUserId,
        {
          companyName: "New Company",
          roleTitle: "Senior Dev",
        },
      );

      expect(updated!.companyName).toBe("New Company");
      expect(updated!.roleTitle).toBe("Senior Dev");
    });

    it("should allow partial updates", async () => {
      const created = await applicationService.createApplication(testUserId, {
        companyName: "Company",
        roleTitle: "Dev",
        location: "NYC",
      });

      const updated = await applicationService.updateApplication(
        created.id,
        testUserId,
        { location: "Remote" },
      );

      expect(updated!.companyName).toBe("Company");
      expect(updated!.location).toBe("Remote");
    });

    it("should throw NotFoundError when application does not exist", async () => {
      await expect(
        applicationService.updateApplication(
          "00000000-0000-0000-0000-000000000000",
          testUserId,
          { companyName: "New Company" },
        ),
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw UnauthorizedError when user does not own application", async () => {
      const created = await applicationService.createApplication(testUserId, {
        companyName: "Private Company",
        roleTitle: "Developer",
      });

      await expect(
        applicationService.updateApplication(created.id, otherUserId, {
          companyName: "Hacked Company",
        }),
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe("updateApplicationStatus", () => {
    it("should update status with valid transition", async () => {
      const created = await applicationService.createApplication(testUserId, {
        companyName: "Transition Company",
        roleTitle: "Developer",
      });

      const updated = await applicationService.updateApplicationStatus(
        created.id,
        testUserId,
        { status: "SCREENING" },
      );

      expect(updated!.status).toBe("SCREENING");
    });

    it("should create activity log entry", async () => {
      const created = await applicationService.createApplication(testUserId, {
        companyName: "Log Company",
        roleTitle: "Developer",
      });

      await applicationService.updateApplicationStatus(
        created.id,
        testUserId,
        { status: "SCREENING", note: "Phone screen scheduled" },
      );

      const logs = await db.select().from(activityLogs);
      const appLogs = logs.filter((log) => log.applicationId === created.id);

      expect(appLogs).toHaveLength(1);
      expect(appLogs[0]!.fromStatus).toBe("APPLIED");
      expect(appLogs[0]!.toStatus).toBe("SCREENING");
      expect(appLogs[0]!.note).toBe("Phone screen scheduled");
    });

    it("should throw BadRequestError for invalid transition (APPLIED -> ACCEPTED)", async () => {
      const created = await applicationService.createApplication(testUserId, {
        companyName: "Invalid Company",
        roleTitle: "Developer",
      });

      await expect(
        applicationService.updateApplicationStatus(created.id, testUserId, {
          status: "ACCEPTED",
        }),
      ).rejects.toThrow(BadRequestError);
    });

    it("should throw BadRequestError for invalid transition (REJECTED -> SCREENING)", async () => {
      const created = await applicationService.createApplication(testUserId, {
        companyName: "Rejected Company",
        roleTitle: "Developer",
      });

      await applicationService.updateApplicationStatus(created.id, testUserId, {
        status: "REJECTED",
      });

      await expect(
        applicationService.updateApplicationStatus(created.id, testUserId, {
          status: "SCREENING",
        }),
      ).rejects.toThrow(BadRequestError);
    });

    it("should throw NotFoundError when application does not exist", async () => {
      await expect(
        applicationService.updateApplicationStatus(
          "00000000-0000-0000-0000-000000000000",
          testUserId,
          { status: "SCREENING" },
        ),
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw UnauthorizedError when user does not own application", async () => {
      const created = await applicationService.createApplication(testUserId, {
        companyName: "OtherApp",
        roleTitle: "Developer",
      });

      await expect(
        applicationService.updateApplicationStatus(
          created.id,
          otherUserId,
          { status: "SCREENING" },
        ),
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe("deleteApplication", () => {
    it("should delete application and return success", async () => {
      const created = await applicationService.createApplication(testUserId, {
        companyName: "Delete Company",
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

    it("should throw NotFoundError when application does not exist", async () => {
      await expect(
        applicationService.deleteApplication(
          "00000000-0000-0000-0000-000000000000",
          testUserId,
        ),
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw UnauthorizedError when user does not own application", async () => {
      const created = await applicationService.createApplication(testUserId, {
        companyName: "Protected Company",
        roleTitle: "Developer",
      });

      await expect(
        applicationService.deleteApplication(
          created.id,
          otherUserId,
        ),
      ).rejects.toThrow(UnauthorizedError);
    });
  });
});
