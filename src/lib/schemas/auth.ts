import { z } from "zod";

export const UserRoleSchema = z.enum(["admin", "teacher", "student"]);

export const AccountStatusSchema = z.enum(["pending", "approved"]);

export const UserProfileSchema = z.object({
  id: z.string().min(1),
  full_name: z.string().min(2, "El nombre completo debe tener al menos 2 caracteres"),
  email: z.string().email("Correo electrónico inválido"),
  role: UserRoleSchema,
  avatar_url: z.string().url().optional().or(z.literal("")),
  account_status: AccountStatusSchema,
  matricula_unrn: z.string().optional(),
  cohorte: z.string().optional(),
  github_user: z.string().optional(),
});

export type UserProfileValidated = z.infer<typeof UserProfileSchema>;
