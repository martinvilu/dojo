"use client";

import React, { useState, useMemo } from "react";

export interface ClassInstance {
  id?: string;
  course_id?: string;
  course_name?: string;
  date: string;
  type: string;
  topic: string;
  special_status: "Normal" | "Clase Remota" | "Examen" | "Feriado";
  description?: string;
  classNumber?: number;
  video_url?: string;
  bookmarks?: { id: string; timestamp: string; label: string }[];
}

export interface Assignment {
  id: string;
  course_id?: string;
  course_name?: string;
  title: string;
  due_date?: string;
  description?: string;
}

export interface CourseFilter {
  id: string;
  name: string;
}

// Distinct per-course accents so subjects are recognizable at a glance.
// Classes must stay statically named for Tailwind's JIT scanner.
const COURSE_PALETTE = [
  { dot: "bg-blue-400", edge: "border-l-blue-400" },
  { dot: "bg-emerald-400", edge: "border-l-emerald-400" },
  { dot: "bg-amber-400", edge: "border-l-amber-400" },
  { dot: "bg-purple-400", edge: "border-l-purple-400" },
  { dot: "bg-pink-400", edge: "border-l-pink-400" },
  { dot: "bg-cyan-400", edge: "border-l-cyan-400" },
  { dot: "bg-orange-400", edge: "border-l-orange-400" },
  { dot: "bg-lime-400", edge: "border-l-lime-400" },
];

function courseAccentOf(courseId?: string) {
  if (!courseId) return null;
  let hash = 0;
  for (let i = 0; i < courseId.length; i++) {
    hash = (hash * 31 + courseId.charCodeAt(i)) >>> 0;
  }
  return COURSE_PALETTE[hash % COURSE_PALETTE.length];
}

interface CalendarPanelProps {
  activeTab: string;
  classes: ClassInstance[];
  assignments: Assignment[];
  courses?: CourseFilter[];
  activeCourseName?: string;
  onAddBookmark?: (classId: string, timestamp: string, label: string) => void;
}

export default function CalendarPanel({
  activeTab,
  classes,
  assignments,
  courses = [],
  onAddBookmark,
}: CalendarPanelProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [hiddenCourseIds, setHiddenCourseIds] = useState<Set<string>>(new Set());
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  // Bookmark input states inside event modal
  const [newBookmarkTime, setNewBookmarkTime] = useState("");
  const [newBookmarkLabel, setNewBookmarkLabel] = useState("");

  const toggleCourseVisibility = (id: string) => {
    setHiddenCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const showAllCourses = () => setHiddenCourseIds(new Set());
  const hideAllCourses = () => setHiddenCourseIds(new Set(courses.map((c) => c.id)));

  // Events without an associated course (legacy data) always stay visible
  const isCourseVisible = (courseId?: string) =>
    !courseId || !hiddenCourseIds.has(courseId);

  // Filter events by the multi-subject checkbox selection
  const filteredClasses = useMemo(() => {
    return classes.filter((c) => isCourseVisible(c.course_id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classes, hiddenCourseIds]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => isCourseVisible(a.course_id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments, hiddenCourseIds]);

  const visibleCourseCount = courses.filter((c) => !hiddenCourseIds.has(c.id)).length;
  const allVisible = hiddenCourseIds.size === 0;

  // Helper: Format date to YYYY-MM-DD local string
  const toLocalDateString = (date: Date) => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60 * 1000);
    return localDate.toISOString().split("T")[0];
  };

  // Helper: Format raw event dates into clean Spanish format
  const formatEventDate = (rawDate?: string) => {
    if (!rawDate) return "-";
    try {
      const dateParts = rawDate.split("T");
      const [year, month, day] = dateParts[0].split("-").map(Number);
      if (!year || !month || !day) return rawDate;
      const d = new Date(Date.UTC(year, month - 1, day));
      const formattedDate = d.toLocaleDateString("es-AR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
      const capitalized = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
      if (dateParts[1] && !dateParts[1].startsWith("00:00:00")) {
        const timePart = dateParts[1].substring(0, 5);
        return `${capitalized}, ${timePart} hs`;
      }
      return capitalized;
    } catch {
      return rawDate;
    }
  };

  // Pre-compute events by date to optimize O(N) filtering on every calendar day
  const eventsByDate = useMemo(() => {
    const map = new Map<string, any[]>();

    const addEventToMap = (dateStr: string, event: any) => {
      if (!map.has(dateStr)) {
        map.set(dateStr, []);
      }
      map.get(dateStr)!.push(event);
    };

    filteredClasses.forEach((c) => {
      if (!c.date) return;
      const cDateStr = typeof c.date === "string" ? c.date.slice(0, 10) : "";
      if (cDateStr) {
        addEventToMap(cDateStr, {
          type: "class",
          title: c.topic || c.type || `Clase ${c.classNumber || ""}`,
          special_status: c.special_status || "Normal",
          details: c,
        });
      }
    });

    filteredAssignments.forEach((a) => {
      if (!a.due_date) return;
      const aDateStr = typeof a.due_date === "string" ? a.due_date.slice(0, 10) : "";
      if (aDateStr) {
        addEventToMap(aDateStr, {
          type: "assignment",
          title: `📝 Tarea: ${a.title}`,
          details: a,
        });
      }
    });

    return map;
  }, [filteredClasses, filteredAssignments]);

  // ⚡ Bolt Optimization: Precompute today's date string once per render
  // Avoids O(N) Date instantiations and conversions inside the .map loops (up to 42 times per month view render).
  const todayStr = toLocalDateString(new Date());

  // Parsing event dates
  const getEventsForDate = (dateStr: string) => {
    return eventsByDate.get(dateStr) || [];
  };

  // MONTH VIEW CALCULATION
  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const totalDays = lastDayOfMonth.getDate();
    
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek < 0) startDayOfWeek = 6;

    const monthDays: { date: Date; isCurrentMonth: boolean }[] = [];
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      monthDays.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }

    for (let i = 1; i <= totalDays; i++) {
      monthDays.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    const remainingCells = 42 - monthDays.length;
    for (let i = 1; i <= remainingCells; i++) {
      monthDays.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return monthDays;
  };

  // WEEK VIEW CALCULATION
  const getWeekDays = () => {
    const weekDays: Date[] = [];
    const currentDay = currentDate.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    
    const monday = new Date(currentDate);
    monday.setDate(currentDate.getDate() + distanceToMonday);

    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      weekDays.push(day);
    }
    return weekDays;
  };

  const handlePrev = () => {
    if (viewMode === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else {
      const prevWeek = new Date(currentDate);
      prevWeek.setDate(currentDate.getDate() - 7);
      setCurrentDate(prevWeek);
    }
  };

  const handleNext = () => {
    if (viewMode === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else {
      const nextWeek = new Date(currentDate);
      nextWeek.setDate(currentDate.getDate() + 7);
      setCurrentDate(nextWeek);
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const visibleCourses = courses.filter((c) => !hiddenCourseIds.has(c.id));
  const exportKey =
    visibleCourseCount === 1 ? visibleCourses[0].id : allVisible ? "all" : "seleccion";

  // iCal / ICS Exporter
  const handleExportICS = () => {
    let icsContent = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Jutsu Classroom//Calendar//ES\r\nCALSCALE:GREGORIAN\r\n";

    filteredClasses.forEach((c) => {
      if (c.date) {
        const cleanDate = c.date.replace(/-/g, "");
        icsContent += `BEGIN:VEVENT\r\nSUMMARY:[Clase] ${c.topic || c.type || "Clase"}\r\nDTSTART;VALUE=DATE:${cleanDate}\r\nDESCRIPTION:${(c.description || "").replace(/\n/g, " ")}\r\nEND:VEVENT\r\n`;
      }
    });

    filteredAssignments.forEach((a) => {
      if (a.due_date) {
        const cleanDate = a.due_date.split("T")[0].replace(/-/g, "");
        icsContent += `BEGIN:VEVENT\r\nSUMMARY:[Tarea] ${a.title}\r\nDTSTART;VALUE=DATE:${cleanDate}\r\nDESCRIPTION:${(a.description || "").replace(/\n/g, " ")}\r\nEND:VEVENT\r\n`;
      }
    });

    icsContent += "END:VCALENDAR\r\n";

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `jutsu_classroom_calendar_${exportKey}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGoogleCalendarSubscribe = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://dojo--jutsu-classroom-mrtin.us-east4.hosted.app";
    let feedUrl = `${origin}/api/calendar`;
    if (visibleCourseCount === 1) {
      feedUrl += `?id=${visibleCourses[0].id}`;
    }
    const googleCalUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(feedUrl)}`;
    window.open(googleCalUrl, "_blank");
  };

  const handleGoogleCalendarAddEvent = (eventObj: any) => {
    if (!eventObj) return;
    const title = eventObj.title || "Clase Ninja Dojo";
    const details = eventObj.details?.description || eventObj.details?.topic || "Evento de Ninja Dojo";
    const dateStr = eventObj.details?.date || eventObj.details?.due_date || new Date().toISOString().split("T")[0];
    const cleanDate = dateStr.split("T")[0].replace(/-/g, "");
    const dates = `${cleanDate}/${cleanDate}`;
    const googleEventUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${dates}&details=${encodeURIComponent(details)}`;
    window.open(googleEventUrl, "_blank");
  };

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const weekdayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

  const handleCreateBookmark = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookmarkTime || !newBookmarkLabel || !selectedEvent) return;
    if (onAddBookmark && selectedEvent.details.id) {
      onAddBookmark(selectedEvent.details.id, newBookmarkTime, newBookmarkLabel);
    }
    if (!selectedEvent.details.bookmarks) selectedEvent.details.bookmarks = [];
    selectedEvent.details.bookmarks.push({
      id: String(Date.now()),
      timestamp: newBookmarkTime,
      label: newBookmarkLabel,
    });
    setNewBookmarkTime("");
    setNewBookmarkLabel("");
  };

  if (activeTab !== "calendar") return null;

  return (
    <div className="space-y-6">
      {/* HEADER CONTROLS & FILTER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-bg-secondary p-5 rounded-2xl border border-border-custom shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-text-primary">📅 Calendario de Cátedras</h2>
          <p className="text-xs text-text-secondary mt-1">
            Filtra tus materias o exporta tu cronograma en formato iCal (.ics)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* MULTI-SUBJECT CHECKBOX FILTER BAR */}
          {courses.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-text-secondary uppercase">Materias:</span>
                <button
                  type="button"
                  onClick={showAllCourses}
                  disabled={allVisible}
                  className="text-[10px] font-bold text-blue-400 hover:text-blue-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer uppercase tracking-wider"
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={hideAllCourses}
                  disabled={hiddenCourseIds.size === courses.length}
                  className="text-[10px] font-bold text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer uppercase tracking-wider"
                >
                  Ninguna
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar eventos por materia">
                {courses.map((c) => {
                  const visible = !hiddenCourseIds.has(c.id);
                  const accent = courseAccentOf(c.id);
                  return (
                    <label
                      key={c.id}
                      title={visible ? "Ocultar esta materia" : "Mostrar esta materia"}
                      className={`flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full border cursor-pointer text-[11px] font-semibold transition select-none ${
                        visible
                          ? "bg-bg-primary border-border-custom text-text-primary"
                          : "border-dashed border-border-custom text-text-secondary/50 opacity-60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={() => toggleCourseVisibility(c.id)}
                        className="h-3 w-3 accent-blue-500 cursor-pointer"
                      />
                      <span className={`w-2 h-2 rounded-full shrink-0 ${accent ? accent.dot : "bg-gray-400"}`} />
                      <span className="max-w-[150px] truncate">{c.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* VISTA TOGGLE */}
          <div className="flex items-center space-x-1 bg-bg-primary p-1 rounded-xl border border-border-custom">
            <button
              onClick={() => setViewMode("month")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === "month" ? "bg-blue-600 text-white" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Vista Mensual
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === "week" ? "bg-blue-600 text-white" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Vista Semanal
            </button>
          </div>

          {/* EXPORT ICAL & GOOGLE CALENDAR BUTTONS */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportICS}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer flex items-center space-x-1.5 shadow-sm"
              title="Exportar archivo iCal (.ics) para Google Calendar, Outlook o Apple Calendar"
            >
              <span>📥 Exportar .ics</span>
            </button>
            <button
              onClick={handleGoogleCalendarSubscribe}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer flex items-center space-x-1.5 shadow-sm"
              title="Atajo para añadir este calendario automáticamente en Google Calendar"
            >
              <span>📅 Añadir a Google Calendar</span>
            </button>
          </div>
        </div>
      </div>

      {/* CALENDAR HEADER CONTROLS */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-text-primary flex items-center space-x-2">
          <span>📅</span>
          <span>
            {viewMode === "month"
              ? `${monthNames[currentDate.getMonth()]} de ${currentDate.getFullYear()}`
              : `Semana del ${getWeekDays()[0].getDate()} de ${monthNames[getWeekDays()[0].getMonth()]}`}
          </span>
        </h3>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrev}
            className="px-3 py-1.5 bg-bg-secondary hover:bg-bg-tertiary border border-border-custom rounded-xl text-text-secondary hover:text-text-primary transition cursor-pointer text-xs font-medium"
          >
            ◀ Anterior
          </button>
          <button
            onClick={handleToday}
            className="px-3 py-1.5 bg-bg-secondary hover:bg-bg-tertiary border border-border-custom rounded-xl text-xs font-bold text-text-primary transition cursor-pointer"
          >
            Hoy
          </button>
          <button
            onClick={handleNext}
            className="px-3 py-1.5 bg-bg-secondary hover:bg-bg-tertiary border border-border-custom rounded-xl text-text-secondary hover:text-text-primary transition cursor-pointer text-xs font-medium"
          >
            Siguiente ▶
          </button>
        </div>
      </div>

      {/* MONTH VIEW GRID */}
      {viewMode === "month" && (
        <div className="bg-bg-secondary border border-border-custom rounded-2xl overflow-x-auto shadow-sm w-full">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-7 border-b border-border-custom bg-bg-primary/50 text-center py-2.5 text-xs font-semibold text-text-secondary select-none">
              {weekdayNames.map((name) => (
                <div key={name}>{name}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 grid-rows-6 divide-x divide-y divide-border-custom border-t border-border-custom">
            {getMonthDays().map(({ date, isCurrentMonth }, idx) => {
              const dateStr = toLocalDateString(date);
              const dayEvents = getEventsForDate(dateStr);
              const isToday = todayStr === dateStr;

              return (
                <div
                  key={idx}
                  className={`min-h-[105px] p-2 flex flex-col justify-between transition-colors ${
                    isCurrentMonth ? "bg-bg-secondary" : "bg-bg-primary/30 text-text-secondary/40"
                  } ${isToday ? "ring-2 ring-blue-500/60 bg-blue-500/5" : ""}`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span
                      className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ${
                        isToday
                          ? "bg-blue-600 text-white"
                          : isCurrentMonth
                          ? "text-text-primary"
                          : "text-text-secondary/40"
                      }`}
                    >
                      {date.getDate()}
                    </span>
                  </div>

                  <div className="flex-1 space-y-1 overflow-y-auto">
                    {dayEvents.map((evt, eIdx) => {
                      let badgeClass = "bg-blue-950/50 text-blue-400 border-blue-800/40";
                      if (evt.type === "class") {
                        if (evt.special_status === "Clase Remota") {
                          badgeClass = "bg-amber-500/20 text-amber-500 border-amber-500/30";
                        } else if (evt.special_status === "Examen") {
                          badgeClass = "bg-purple-500/20 text-purple-400 border-purple-500/30";
                        } else if (evt.special_status === "Feriado") {
                          badgeClass = "bg-red-500/20 text-red-400 border-red-500/30 line-through";
                        } else {
                          badgeClass = "bg-emerald-500/20 text-emerald-500 border-emerald-500/30";
                        }
                      } else {
                        badgeClass = "bg-pink-500/20 text-pink-400 border-pink-500/30 font-semibold";
                      }

                      const accent = courseAccentOf(evt.details?.course_id);

                      return (
                        <button
                          key={eIdx}
                          onClick={() => setSelectedEvent(evt)}
                          title={evt.details?.course_name ? `${evt.details.course_name} — ${evt.title}` : evt.title}
                          className={`w-full text-left truncate px-2 py-0.5 rounded text-[10px] border transition hover:scale-[1.02] cursor-pointer flex items-center space-x-1 ${badgeClass} ${accent ? `border-l-2 ${accent.edge}` : ""}`}
                        >
                          {accent && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${accent.dot}`} aria-hidden="true" />}
                          <span>{evt.type === "assignment" ? "📝" : "•"}</span>
                          <span className="truncate">{evt.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </div>
      )}

      {/* WEEK VIEW GRID */}
      {viewMode === "week" && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {getWeekDays().map((date, idx) => {
            const dateStr = toLocalDateString(date);
            const dayEvents = getEventsForDate(dateStr);
            const isToday = todayStr === dateStr;

            return (
              <div
                key={idx}
                className={`bg-bg-secondary border rounded-2xl p-4 flex flex-col space-y-3 transition-all ${
                  isToday ? "border-blue-500 ring-2 ring-blue-500/30 bg-blue-500/5" : "border-border-custom"
                }`}
              >
                <div className="border-b border-border-custom pb-2 flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                      {weekdayNames[idx]}
                    </h4>
                    <span className="text-lg font-black text-text-primary">{date.getDate()}</span>
                  </div>
                  {isToday && (
                    <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-[9px] font-bold uppercase tracking-wider">
                      Hoy
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  {dayEvents.map((evt, eIdx) => {
                    let badgeClass = "bg-bg-primary border-border-custom";
                    let titleColor = "text-text-primary";
                    if (evt.type === "class") {
                      if (evt.special_status === "Clase Remota") {
                        badgeClass = "bg-amber-500/10 border-amber-500/30";
                        titleColor = "text-amber-500";
                      } else if (evt.special_status === "Examen") {
                        badgeClass = "bg-purple-500/10 border-purple-500/30";
                        titleColor = "text-purple-400";
                      } else if (evt.special_status === "Feriado") {
                        badgeClass = "bg-red-500/10 border-red-500/30 opacity-60 line-through";
                        titleColor = "text-red-400";
                      } else {
                        badgeClass = "bg-emerald-500/10 border-emerald-500/30";
                        titleColor = "text-emerald-500";
                      }
                    } else {
                      badgeClass = "bg-pink-500/10 border-pink-500/30";
                      titleColor = "text-pink-400";
                    }

                    const accent = courseAccentOf(evt.details?.course_id);

                    return (
                      <div
                        key={eIdx}
                        onClick={() => setSelectedEvent(evt)}
                        className={`p-3 rounded-xl border transition hover:scale-[1.02] cursor-pointer space-y-1.5 text-left ${badgeClass} ${accent ? `border-l-4 ${accent.edge}` : ""}`}
                      >
                        <span className="text-[9px] font-bold text-text-secondary uppercase tracking-widest block">
                          {evt.type === "assignment" ? "Entrega" : "Clase"}
                          {evt.details?.course_name && (
                            <span className="inline-flex items-center gap-1 ml-1.5 normal-case tracking-normal">
                              <span className={`w-1.5 h-1.5 rounded-full inline-block ${accent ? accent.dot : "bg-gray-400"}`} aria-hidden="true" />
                              {evt.details.course_name}
                            </span>
                          )}
                        </span>
                        <h5 className={`text-xs font-bold leading-tight ${titleColor}`}>
                          {evt.title}
                        </h5>
                      </div>
                    );
                  })}

                  {dayEvents.length === 0 && (
                    <p className="text-[10px] text-text-secondary italic text-center py-6">Sin eventos</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EVENT DETAIL & BOOKMARKS MODAL */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl max-w-lg w-full min-w-[280px] sm:min-w-[460px] shrink-0 mx-auto max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl relative text-left">
            <button
              onClick={() => setSelectedEvent(null)}
              aria-label="Cerrar detalles"
              type="button"
              className="absolute top-4 right-4 text-text-secondary hover:text-text-primary transition text-sm font-bold p-1 cursor-pointer"
            >
              ✕
            </button>

            <span className="chip-status text-[10px] font-bold uppercase font-mono tracking-wider bg-bg-primary text-text-secondary border border-border-custom">
              {selectedEvent.type === "assignment" ? "📝 Entrega de Tarea" : "📅 Sesión de Clase"}
            </span>

            {selectedEvent.details?.course_name && (
              <span className="inline-flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full bg-bg-primary border border-border-custom text-[10px] font-bold text-text-secondary align-middle">
                <span
                  className={`w-2 h-2 rounded-full ${courseAccentOf(selectedEvent.details?.course_id)?.dot || "bg-gray-400"}`}
                  aria-hidden="true"
                />
                {selectedEvent.details.course_name}
              </span>
            )}

            <div className="space-y-1 pt-1">
              <h3 className="text-lg font-bold text-text-primary leading-tight">{selectedEvent.title}</h3>
              {selectedEvent.type === "class" && (
                <div className="flex gap-2 mt-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-bg-primary border border-border-custom text-[11px] font-bold text-text-secondary font-mono">
                    Clase {selectedEvent.details.classNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-bg-primary border border-border-custom text-[11px] font-bold text-text-secondary">
                    Tipo: {selectedEvent.details.type || "Normal"}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3 border-t border-border-custom pt-3 text-xs text-text-primary">
              {selectedEvent.type === "class" ? (
                <>
                  <p className="text-xs">
                    <strong className="text-text-secondary">Fecha:</strong>{" "}
                    <span className="font-semibold text-text-primary font-mono">
                      {formatEventDate(selectedEvent.details.date)}
                    </span>
                  </p>
                  {selectedEvent.details.description && (
                    <div className="bg-bg-primary p-3 rounded border border-border-custom max-h-36 overflow-y-auto">
                      <p className="text-xs text-text-secondary leading-relaxed">
                        {selectedEvent.details.description}
                      </p>
                    </div>
                  )}

                  {/* RECORDING & MARCADORES TEMPORALES (BOOKMARKS) */}
                  {selectedEvent.details.video_url && (
                    <div className="space-y-2 pt-2 border-t border-border-custom">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-text-primary">🎥 Grabación de la clase</span>
                        <a
                          href={selectedEvent.details.video_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-tertiary hover:underline font-semibold"
                        >
                          Ver Video ↗
                        </a>
                      </div>

                      {/* BOOKMARKS LIST */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-text-secondary uppercase">
                          🔖 Marcadores Temporales:
                        </label>
                        {selectedEvent.details.bookmarks && selectedEvent.details.bookmarks.length > 0 ? (
                          <div className="space-y-1 max-h-28 overflow-y-auto">
                            {selectedEvent.details.bookmarks.map((bm: any, bIdx: number) => (
                              <div
                                key={bIdx}
                                className="flex justify-between items-center bg-bg-primary p-2 rounded border border-border-custom text-[11px]"
                              >
                                <span className="font-mono text-tertiary font-bold">{bm.timestamp}</span>
                                <span className="text-text-secondary font-medium">{bm.label}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-text-secondary italic">No hay marcadores temporales guardados.</p>
                        )}
                      </div>

                      {/* ADD BOOKMARK FORM */}
                      <form onSubmit={handleCreateBookmark} className="flex gap-2 pt-1">
                        <input
                          type="text"
                          value={newBookmarkTime}
                          onChange={(e) => setNewBookmarkTime(e.target.value)}
                          placeholder="Minuto (Ej: 12:45)"
                          className="input-academic w-28 text-[11px] font-mono"
                        />
                        <input
                          type="text"
                          value={newBookmarkLabel}
                          onChange={(e) => setNewBookmarkLabel(e.target.value)}
                          placeholder="Tema / Explicación"
                          className="input-academic flex-1 text-[11px]"
                        />
                        <button
                          type="submit"
                          className="btn-primary min-w-[70px] min-h-[32px] text-xs py-1"
                        >
                          + Agregar
                        </button>
                      </form>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs">
                    <strong className="text-text-secondary">Fecha Límite:</strong>{" "}
                    <span className="font-semibold text-text-primary font-mono">
                      {formatEventDate(selectedEvent.details.due_date)}
                    </span>
                  </p>
                  {selectedEvent.details.description && (
                    <div className="bg-bg-primary p-3 rounded border border-border-custom max-h-36 overflow-y-auto">
                      <p className="text-xs text-text-secondary leading-relaxed">
                        {selectedEvent.details.description}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-border-custom">
              <button
                type="button"
                onClick={() => handleGoogleCalendarAddEvent(selectedEvent)}
                className="btn-primary flex-1 shadow-sm"
              >
                <span>📅 Agregar a Google Calendar</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="btn-secondary min-w-[90px]"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

