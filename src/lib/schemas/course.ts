import { z } from "zod";

export const CourseSchema = z.object({
  id: z.string().min(1, "El ID de curso es obligatorio"),
  name: z.string().min(2, "El nombre de la materia debe tener al menos 2 caracteres"),
  description: z.string().optional(),
  commission: z.string().optional(),
  year: z.union([z.number(), z.string()]).optional(),
  semester: z.union([z.number(), z.string()]).optional(),
  icon: z.string().optional(),
  github_org: z.string().optional(),
  moodle_course_id: z.string().optional(),
});

export type CourseInput = z.infer<typeof CourseSchema>;

export const AssignmentSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2, "El título de la tarea es requerido"),
  description: z.string().optional(),
  deadline: z.string().min(1, "La fecha límite es requerida"),
  course_id: z.string().min(1, "El curso es requerido"),
  github_repo_prefix: z.string().optional(),
  peer_review_enabled: z.boolean().optional().default(false),
});

export type AssignmentInput = z.infer<typeof AssignmentSchema>;
