import { NextResponse } from "next/server";
import { requireCourseSubscriptionToken, sanitizeLine } from "../middleware/api";

export const dynamic = "force-dynamic";

/**
 * Subscription iCal feed for a course. Serves the real schedule from
 * Firestore behind the per-course sync_secret share token (same scheme as
 * the CSV export cloud functions).
 */

function icsDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

const DAY_MAP: Record<string, number> = {
  Domingo: 0, Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4, Viernes: 5, Sábado: 6,
};
const RRULE_DAY_MAP: Record<number, string> = {
  0: "SU", 1: "MO", 2: "TU", 3: "WE", 4: "TH", 5: "FR", 6: "SA",
};

function buildCourseIcs(courseId: string, course: any): string {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Jutsu Classroom//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${sanitizeLine(course.name || "Cursada")}`,
  ];

  if (Array.isArray(course.class_instances) && course.class_instances.length > 0) {
    course.class_instances.forEach((ci: any, idx: number) => {
      if (ci.special_status === "Feriado") return;

      const startDt = new Date(ci.date);
      if (isNaN(startDt.getTime())) return;
      const endDt = new Date(startDt.getTime() + 2 * 3600000);

      let title = `${course.name} - ${ci.type}`;
      if (ci.special_status === "Examen") title = `[EXAMEN] ${title}`;
      if (ci.special_status === "Clase Remota") title = `[REMOTA] ${title}`;

      let desc = ci.topic ? `Tema: ${sanitizeLine(ci.topic)}\\n` : "";
      if (ci.presentation_url) desc += `Presentación: ${sanitizeLine(ci.presentation_url)}\\n`;
      if (ci.recording_url) desc += `Grabación: ${sanitizeLine(ci.recording_url)}\\n`;

      ics.push(
        "BEGIN:VEVENT",
        `UID:course_${courseId}_ci_${idx}@jutsu.classroom`,
        `DTSTAMP:${icsDateTime(new Date())}`,
        `DTSTART:${icsDateTime(startDt)}`,
        `DTEND:${icsDateTime(endDt)}`,
        `SUMMARY:${sanitizeLine(title)}`,
        ...(desc ? [`DESCRIPTION:${desc}`] : []),
        "END:VEVENT"
      );
    });
  } else if (course.start_date && course.duration_weeks && Array.isArray(course.schedules)) {
    const [y, m, d] = String(course.start_date).split("-").map(Number);
    const baseDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));

    course.schedules.forEach((sch: any, idx: number) => {
      const targetDay = DAY_MAP[sch.day];
      if (targetDay === undefined) return;

      let diff = targetDay - baseDate.getUTCDay();
      if (diff < 0) diff += 7;

      const firstClassDate = new Date(baseDate.getTime() + diff * 86400000);
      const [hh, mm] = String(sch.time || "00:00").split(":").map(Number);
      firstClassDate.setUTCHours(hh, mm, 0);
      const endDate = new Date(firstClassDate.getTime() + 2 * 3600000);

      ics.push(
        "BEGIN:VEVENT",
        `UID:course_${courseId}_sch_${idx}@jutsu.classroom`,
        `DTSTAMP:${icsDateTime(new Date())}`,
        `DTSTART:${icsDateTime(firstClassDate)}`,
        `DTEND:${icsDateTime(endDate)}`,
        `RRULE:FREQ=WEEKLY;COUNT=${course.duration_weeks};BYDAY=${RRULE_DAY_MAP[targetDay]}`,
        `SUMMARY:${sanitizeLine(`${course.name} - ${sch.type}`)}`,
        `DESCRIPTION:Clase ${sanitizeLine(sch.type)} de ${sanitizeLine(course.name)}`,
        "END:VEVENT"
      );
    });
  }

  ics.push("END:VCALENDAR", "");
  return ics.join("\r\n");
}

async function fetchExternalEvents(icsLines: string[], urls: string[]): Promise<void> {
  for (const url of urls || []) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const externalIcs = await response.text();
      const vevents = externalIcs.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/gi);
      if (vevents) vevents.forEach((ev) => icsLines.push(ev));
    } catch {
      // External calendars must not break the primary feed
    }
  }
}

export async function GET(request: Request) {
  const sub = await requireCourseSubscriptionToken(request);
  if (sub instanceof NextResponse) return sub;
  const { courseId, course } = sub;

  try {
    const base = buildCourseIcs(courseId, course);
    // Extract just the event blocks so external calendars can be merged
    const vevents = base.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];
    const lines: string[] = [...vevents];

    if (Array.isArray(course.external_calendars) && course.external_calendars.length > 0) {
      await fetchExternalEvents(lines, course.external_calendars);
    }

    const full = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Jutsu Classroom//ES",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${sanitizeLine(course.name || "Cursada")}`,
      ...lines,
      "END:VCALENDAR",
      "",
    ].join("\r\n");

    return new Response(full, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="cursada_${courseId}.ics"`,
        "Cache-Control": "private, max-age=900"
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al generar el calendario: " + error.message },
      { status: 500 }
    );
  }
}

export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8"
    }
  });
}
