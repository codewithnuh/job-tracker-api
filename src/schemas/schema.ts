import z from "zod";

export const registrationSchema = z.object({
  name: z.string().min(3, "Name is required"),
  email: z.email().trim(),
  password: z.string().min(8, "Password should be at least 8 digit long"),
});
export const loginSchema = z.object({
  email: z.email().trim(),
  password: z.string().min(8, "Password should be at least 8 digit long"),
});

export const createApplicationSchema = z.object({
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
  jobUrl: z.string().url("Invalid job URL").optional().nullable().or(z.literal("")),
  salaryMin: z.number().int().positive().optional().nullable(),
  salaryMax: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateApplicationSchema = z.object({
  companyName: z.string().min(1, "Company name is required").optional(),
  roleTitle: z.string().min(1, "Role title is required").optional(),
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
    .optional(),
  location: z.string().optional().nullable(),
  jobUrl: z.string().url("Invalid job URL").optional().nullable().or(z.literal("")),
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
export type UpdateApplicationType = z.infer<typeof updateApplicationSchema>;
export type UpdateApplicationStatusType = z.infer<
  typeof updateApplicationStatusSchema
>;
export type ActivityLogType = z.infer<typeof activityLogSchema>;
export type loginType = z.infer<typeof loginSchema>;
export type registrationType = z.infer<typeof registrationSchema>;
export type userType = registrationType;
