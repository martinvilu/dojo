import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface CalendarEvent {
  title: string;
  startDate: string; // YYYY-MM-DD or ISO
  endDate?: string;
  description?: string;
  type: "class" | "assignment" | "exam";
  courseName?: string;
}

const DEFAULT_SAMPLE_EVENTS: CalendarEvent[] = [
  {
    title: "Clase 1: Introducción a la Plataforma y Entorno",
    startDate: "2026-08-03",
    description: "Presentación de contenidos, metodología de trabajo y configuración del entorno local.",
    type: "class",
    courseName: "Programación I"
  },
  {
    title: "Clase 2: Algoritmos y Estructuras de Control",
    startDate: "2026-08-10",
    description: "Variables, condicionales, bucles y lógica algorítmica fundamental.",
    type: "class",
    courseName: "Programación I"
  },
  {
    title: "📝 Entrega Práctica 1: Fundamentos de Código",
    startDate: "2026-08-17",
    description: "Fecha límite de entrega de la solución en el repositorio de GitHub.",
    type: "assignment",
    courseName: "Programación I"
  },
  {
    title: "Clase 3: Funciones y Modularización",
    startDate: "2026-08-24",
    description: "Firma de funciones, scope de variables, parámetros y retorno.",
    type: "class",
    courseName: "Programación I"
  },
  {
    title: "📝 Entrega Práctica 2: Algoritmos y Estructuras Data",
    startDate: "2026-08-31",
    description: "Entrega individual o grupal de la guía práctica 2.",
    type: "assignment",
    courseName: "Programación I"
  },
  {
    title: "🚨 Examen Parcial I: Cátedra Programación I",
    startDate: "2026-09-07",
    description: "Evaluación teórica y práctica en sala de computación.",
    type: "exam",
    courseName: "Programación I"
  }
];

function generateICSContent(events: CalendarEvent[], courseName: string = "Jutsu Classroom"): string {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Jutsu Classroom//Calendar Feed 1.0//ES",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${courseName}`,
    "METHOD:PUBLISH"
  ];

  events.forEach((evt, idx) => {
    const cleanDate = evt.startDate.replace(/-/g, "").split("T")[0];
    const createdDate = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    ics.push(
      "BEGIN:VEVENT",
      `UID:jutsu-cal-${idx}-${cleanDate}@jutsuclassroom`,
      `DTSTAMP:${createdDate}`,
      `DTSTART;VALUE=DATE:${cleanDate}`,
      `SUMMARY:[${evt.type.toUpperCase()}] ${evt.title}`,
      `DESCRIPTION:${(evt.description || "").replace(/\n/g, " ")}`,
      `STATUS:CONFIRMED`,
      "END:VEVENT"
    );
  });

  ics.push("END:VCALENDAR", "");
  return ics.join("\r\n");
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("id") || searchParams.get("course") || "";
    const format = searchParams.get("format") || "ics";

    let events = DEFAULT_SAMPLE_EVENTS;

    if (courseId && courseId !== "all") {
      events = events.filter(e => !e.courseName || e.courseName.toLowerCase().includes(courseId.toLowerCase()));
      if (events.length === 0) {
        events = DEFAULT_SAMPLE_EVENTS;
      }
    }

    if (format === "json") {
      return NextResponse.json({
        success: true,
        total: events.length,
        events
      });
    }

    const icsContent = generateICSContent(events, courseId ? `Cátedra ${courseId}` : "Jutsu Classroom");

    return new Response(icsContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="jutsu_classroom_calendar_${courseId || "global"}.ics"`,
        "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al generar el calendario: " + error.message },
      { status: 500 }
    );
  }
}

export async function HEAD(request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8"
    }
  });
}
