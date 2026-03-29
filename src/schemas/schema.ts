import z, { email } from "zod";

export const registrationSchema = z.object({
  name: z.string().min(5, "Name is required"),
  email: z.email().trim(),
  password: z.string().min(8, "Password should be at least 8 digit long"),
});
export const loginSchema = z.object({
  email: z.email().trim(),
  password: z.string().min(8, "Password should be at least 8 digit long"),
});

export type loginType = z.infer<typeof loginSchema>;
export type registrationType = z.infer<typeof registrationSchema>;
export type userType = registrationType;
