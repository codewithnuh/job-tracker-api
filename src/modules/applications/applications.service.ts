import z from "zod";
import {
  createApplicationSchema,
  updateApplicationStatusSchema,
  CreateApplicationType,
  UpdateApplicationStatusType,
} from "../../schemas/schema";
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from "../../utils/errors/http.errors";
import { db } from "../../db/index";
import { applications, activityLogs, users } from "../../db/schema";
import { eq } from "drizzle-orm";
import { canTransition } from "./status-machine";
import { userService } from "../auth/auth.service";

export class ApplicationService {
  async createApplication(
    userId: string,
    input: Omit<CreateApplicationType, "userId">,
  ) {
    if (!userId) {
      throw new BadRequestError("User ID is required");
    }

    // Validate input with zod
    const result = createApplicationSchema.safeParse({ userId, ...input });
    if (!result.success) {
      throw new BadRequestError(
        result.error.issues.map((i) => i.message).join(", "),
      );
    }

    const validatedInput = result.data;

    // Insert into database
    const newApplication = await db
      .insert(applications)
      .values(validatedInput)
      .returning();

    if (!newApplication || newApplication.length === 0) {
      throw new BadRequestError("Failed to create application");
    }

    return newApplication[0]!;
  }

  async getApplication(applicationId: string, userId: string) {
    const application = await db.query.applications.findFirst({
      where: eq(applications.id, applicationId),
    });

    if (!application) {
      throw new NotFoundError("Application not found");
    }

    if (application.userId !== userId) {
      throw new UnauthorizedError("Not authorized to view this application");
    }

    return application!;
  }

  async getAllApplications(userId: string) {
    const userApps = await db.query.applications.findMany({
      where: eq(applications.userId, userId),
      orderBy: (apps, { desc }) => [desc(apps.createdAt)],
    });

    return userApps;
  }

  async updateApplicationStatus(
    applicationId: string,
    userId: string,
    input: UpdateApplicationStatusType,
  ) {
    const application = await db.query.applications.findFirst({
      where: eq(applications.id, applicationId),
    });

    if (!application) {
      throw new NotFoundError("Application not found");
    }

    if (application.userId !== userId) {
      throw new UnauthorizedError("Not authorized to update this application");
    }

    let validatedInput: UpdateApplicationStatusType;

    try {
      validatedInput = updateApplicationStatusSchema.parse(input);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issue = error.issues?.[0];
        throw new BadRequestError(issue?.message || "Invalid input");
      }
      throw error;
    }

    const { status: newStatus, note } = validatedInput;

    if (!canTransition(application.status, newStatus)) {
      throw new BadRequestError(
        `Invalid transition: ${application.status} → ${newStatus}`,
      );
    }

    const [updatedApplication] = await db
      .update(applications)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(applications.id, applicationId))
      .returning();

    await db.insert(activityLogs).values({
      applicationId,
      fromStatus: application.status,
      toStatus: newStatus,
      note: note || null,
    });

    return updatedApplication!;
  }

  async deleteApplication(applicationId: string, userId: string) {
    const application = await db.query.applications.findFirst({
      where: eq(applications.id, applicationId),
    });

    if (!application) {
      throw new NotFoundError("Application not found");
    }

    if (application.userId !== userId) {
      throw new UnauthorizedError("Not authorized to delete this application");
    }

    await db.delete(applications).where(eq(applications.id, applicationId));

    return { success: true };
  }
}

export const applicationService = new ApplicationService();
