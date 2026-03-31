import z from "zod";

export const registrationSchema = z.object({
  name: z.string().min(5, "Name is required"),
  email: z.email().trim(),
  password: z.string().min(8, "Password should be at least 8 digit long"),
});
export const loginSchema = z.object({
  email: z.email().trim(),
  password: z.string().min(8, "Password should be at least 8 digit long"),
});

export const createApplicationSchema = z.object({
  userId: z.uuid("Invalid user ID"), // required
  companyName: z.string().min(1, "Company name is required"),
  roleTitle: z.string().min(1, "Role title is required"),
  status: z
    .enum([
      "APPLIED",
      "SCREENING",
      "INTERVIEW",
      "OFFER",
      "ACCEPTED",
      "REJECTED",
      "WITHDRAWN",
    ])
    .optional(), // default to APPLIED in service
  location: z.string().optional().nullable(),
  jobUrl: z.url("Invalid job URL").optional().nullable(),
  salaryMin: z.number().int().positive().optional().nullable(),
  salaryMax: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Zod schema for updating application status
export const updateApplicationStatusSchema = z.object({
  status: z.enum([
    "APPLIED",
    "SCREENING",
    "INTERVIEW",
    "OFFER",
    "ACCEPTED",
    "REJECTED",
    "WITHDRAWN",
  ]),
  note: z.string().optional().nullable(),
});

// Zod schema for activity logs (for output/validation)
export const activityLogSchema = z.object({
  id: z.uuid(),
  applicationId: z.uuid(),
  fromStatus: z
    .enum([
      "APPLIED",
      "SCREENING",
      "INTERVIEW",
      "OFFER",
      "ACCEPTED",
      "REJECTED",
      "WITHDRAWN",
    ])
    .nullable(),
  toStatus: z.enum([
    "APPLIED",
    "SCREENING",
    "INTERVIEW",
    "OFFER",
    "ACCEPTED",
    "REJECTED",
    "WITHDRAWN",
  ]),
  note: z.string().optional().nullable(),
  createdAt: z.string(), // ISO date string
});

// Types inferred from Zod
export type CreateApplicationType = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationStatusType = z.infer<
  typeof updateApplicationStatusSchema
>;
export type ActivityLogType = z.infer<typeof activityLogSchema>;
export type loginType = z.infer<typeof loginSchema>;
export type registrationType = z.infer<typeof registrationSchema>;
export type userType = registrationType;
