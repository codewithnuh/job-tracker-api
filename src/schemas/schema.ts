import z, { email } from "zod";

export const userSchema = z.object({
  name: z.string().min(5, "Name is required").optional(),
  email: z.email(),
  password: z.string().min(8, "Password should be at least 8 digit long"),
});

export type userType = z.infer<typeof userSchema>;
