import { z } from "zod";

export const MoodleConfigSchema = z.object({
  apiUrl: z
    .string()
    .url("La URL de Moodle debe ser una URL válida (ej. https://moodle.ejemplo.edu)")
    .min(5, "URL requerida"),
  wsToken: z
    .string()
    .min(10, "El token de servicio web debe tener al menos 10 caracteres"),
  courseId: z
    .string()
    .min(1, "El ID de curso en Moodle es requerido"),
});

export type MoodleConfig = z.infer<typeof MoodleConfigSchema>;

export const LtiPayloadSchema = z.object({
  targetModule: z.string().optional().default(""),
  assignmentId: z.string().optional().default(""),
  courseId: z.string().optional().default(""),
  email: z.string().email().optional().or(z.literal("")),
  name: z.string().optional().default("Moodle User"),
  roles: z.array(z.string()).optional().default([]),
  outcomeUrl: z.string().url().optional().or(z.literal("")),
  resultId: z.string().optional().default(""),
});

export type LtiPayload = z.infer<typeof LtiPayloadSchema>;
