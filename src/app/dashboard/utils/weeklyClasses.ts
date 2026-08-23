import type { ClassInstance } from "../types";

/**
 * Groups class instances by ISO week number relative to the Monday of the
 * week containing the first class.
 */
export function getWeeklyClasses(classes: ClassInstance[]): Record<number, ClassInstance[]> {
  if (!classes || classes.length === 0) return {};
  const weeks: Record<number, ClassInstance[]> = {};

  // Find Monday of the first class week
  const firstClassDate = new Date(classes[0].date);
  const dayOfWeek = firstClassDate.getUTCDay();
  const offsetToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const baseMonday = new Date(firstClassDate);
  baseMonday.setUTCDate(baseMonday.getUTCDate() - offsetToMonday);
  baseMonday.setUTCHours(0, 0, 0, 0);

  classes.forEach(ci => {
    const d = new Date(ci.date);
    const diffTime = Math.abs(d.getTime() - baseMonday.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const weekNumber = Math.floor(diffDays / 7) + 1;

    if (!weeks[weekNumber]) weeks[weekNumber] = [];
    weeks[weekNumber].push(ci);
  });

  return weeks;
}
