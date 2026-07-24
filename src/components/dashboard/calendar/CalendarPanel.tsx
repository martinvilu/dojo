"use client";

import React, { useState } from "react";

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
  activeCourseName = "Global",
  onAddBookmark,
}: CalendarPanelProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>("all");
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  // Bookmark input states inside event modal
  const [newBookmarkTime, setNewBookmarkTime] = useState("");
  const [newBookmarkLabel, setNewBookmarkLabel] = useState("");

  if (activeTab !== "calendar") return null;

  // Filter events by selected course
  const filteredClasses = classes.filter((c) => {
    if (selectedCourseFilter === "all") return true;
    return c.course_id === selectedCourseFilter;
  });

  const filteredAssignments = assignments.filter((a) => {
    if (selectedCourseFilter === "all") return true;
    return a.course_id === selectedCourseFilter;
  });

  // Helper: Format date to YYYY-MM-DD local string
  const toLocalDateString = (date: Date) => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60 * 1000);
    return localDate.toISOString().split("T")[0];
  };

  // Parsing event dates
  const getEventsForDate = (dateStr: string) => {
    const dayEvents: any[] = [];

    // Classes on this date
    filteredClasses.forEach((c) => {
      if (!c.date) return;
      const cDateStr = typeof c.date === "string" ? c.date.slice(0, 10) : "";
      if (cDateStr === dateStr || c.date === dateStr || (typeof c.date === "string" && c.date.startsWith(dateStr))) {
        dayEvents.push({
          type: "class",
          title: c.topic || c.type || `Clase ${c.classNumber || ""}`,
          special_status: c.special_status || "Normal",
          details: c,
        });
      }
    });

    // Assignments on this date
    filteredAssignments.forEach((a) => {
      if (!a.due_date) return;
      const aDateStr = typeof a.due_date === "string" ? a.due_date.slice(0, 10) : "";
      if (aDateStr === dateStr || a.due_date === dateStr || (typeof a.due_date === "string" && a.due_date.startsWith(dateStr))) {
        dayEvents.push({
          type: "assignment",
          title: `📝 Tarea: ${a.title}`,
          details: a,
        });
      }
    });

    return dayEvents;
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
    link.download = `jutsu_classroom_calendar_${selectedCourseFilter}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGoogleCalendarSubscribe = () => {
    let feedUrl = `https://us-central1-jutsu-classroom-mrtin.cloudfunctions.net/calendar`;
    if (selectedCourseFilter && selectedCourseFilter !== "all") {
      feedUrl += `?id=${selectedCourseFilter}`;
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
          {/* COURSE FILTER DROPDOWN */}
          <div className="flex items-center space-x-2">
            <label className="text-xs font-semibold text-text-secondary uppercase">Cátedra:</label>
            <select
              value={selectedCourseFilter}
              onChange={(e) => setSelectedCourseFilter(e.target.value)}
              className="bg-bg-primary border border-border-custom text-text-primary rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">🌐 Calendario Global (Todas)</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  📚 {c.name}
                </option>
              ))}
            </select>
          </div>

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
        <div className="bg-bg-secondary border border-border-custom rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-7 border-b border-border-custom bg-bg-primary/50 text-center py-2.5 text-xs font-semibold text-text-secondary select-none">
            {weekdayNames.map((name) => (
              <div key={name}>{name}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 grid-rows-6 divide-x divide-y divide-border-custom border-t border-border-custom">
            {getMonthDays().map(({ date, isCurrentMonth }, idx) => {
              const dateStr = toLocalDateString(date);
              const dayEvents = getEventsForDate(dateStr);
              const isToday = toLocalDateString(new Date()) === dateStr;

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

                      return (
                        <button
                          key={eIdx}
                          onClick={() => setSelectedEvent(evt)}
                          className={`w-full text-left truncate px-2 py-0.5 rounded text-[10px] border transition hover:scale-[1.02] cursor-pointer flex items-center space-x-1 ${badgeClass}`}
                        >
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
      )}

      {/* WEEK VIEW GRID */}
      {viewMode === "week" && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {getWeekDays().map((date, idx) => {
            const dateStr = toLocalDateString(date);
            const dayEvents = getEventsForDate(dateStr);
            const isToday = toLocalDateString(new Date()) === dateStr;

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

                    return (
                      <div
                        key={eIdx}
                        onClick={() => setSelectedEvent(evt)}
                        className={`p-3 rounded-xl border transition hover:scale-[1.02] cursor-pointer space-y-1.5 text-left ${badgeClass}`}
                      >
                        <span className="text-[9px] font-bold text-text-secondary uppercase tracking-widest block">
                          {evt.type === "assignment" ? "Entrega" : "Clase"}
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
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-bg-secondary border border-border-custom p-6 rounded-3xl max-w-md w-full space-y-5 shadow-2xl relative text-left">
            <button
              onClick={() => setSelectedEvent(null)}
              className="absolute top-4 right-4 text-text-secondary hover:text-text-primary transition text-lg p-1.5 focus:outline-none"
            >
              ✕
            </button>

            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block">
              {selectedEvent.type === "assignment" ? "📝 Entrega de Tarea" : "📅 Sesión de Clase"}
            </span>

            <div className="space-y-1">
              <h3 className="text-base font-black text-text-primary">{selectedEvent.title}</h3>
              {selectedEvent.type === "class" && (
                <div className="flex gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded bg-bg-primary border border-border-custom text-[10px] font-bold text-text-secondary font-mono">
                    Clase {selectedEvent.details.classNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-bg-primary border border-border-custom text-[10px] font-bold text-text-secondary">
                    Tipo: {selectedEvent.details.type || "Normal"}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3 border-t border-border-custom pt-3 text-xs text-text-primary">
              {selectedEvent.type === "class" ? (
                <>
                  <p><strong>Fecha:</strong> {selectedEvent.details.date || "-"}</p>
                  {selectedEvent.details.description && (
                    <div className="bg-bg-primary p-3 rounded-xl border border-border-custom max-h-36 overflow-y-auto">
                      <p className="text-[11px] text-text-secondary leading-relaxed">
                        {selectedEvent.details.description}
                      </p>
                    </div>
                  )}

                  {/* RECORDING & MARCADORES TEMPORALES (BOOKMARKS) */}
                  {selectedEvent.details.video_url && (
                    <div className="space-y-2 pt-2 border-t border-border-custom">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs">🎥 Grabación de la clase</span>
                        <a
                          href={selectedEvent.details.video_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-500 hover:underline font-semibold"
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
                                className="flex justify-between items-center bg-bg-primary p-2 rounded-lg border border-border-custom text-[11px]"
                              >
                                <span className="font-mono text-blue-400 font-bold">{bm.timestamp}</span>
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
                          className="w-28 bg-bg-primary border border-border-custom text-text-primary rounded-lg px-2 py-1 text-[11px] focus:outline-none"
                        />
                        <input
                          type="text"
                          value={newBookmarkLabel}
                          onChange={(e) => setNewBookmarkLabel(e.target.value)}
                          placeholder="Tema / Explicación"
                          className="flex-1 bg-bg-primary border border-border-custom text-text-primary rounded-lg px-2 py-1 text-[11px] focus:outline-none"
                        />
                        <button
                          type="submit"
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-lg transition"
                        >
                          + Agregar
                        </button>
                      </form>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p><strong>Fecha Límite:</strong> {selectedEvent.details.due_date ? new Date(selectedEvent.details.due_date).toLocaleString("es-AR") : "-"}</p>
                  {selectedEvent.details.description && (
                    <div className="bg-bg-primary p-3 rounded-xl border border-border-custom max-h-36 overflow-y-auto">
                      <p className="text-[11px] text-text-secondary leading-relaxed">
                        {selectedEvent.details.description}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-border-custom">
              <button
                type="button"
                onClick={() => handleGoogleCalendarAddEvent(selectedEvent)}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center space-x-2 shadow-sm"
              >
                <span>📅</span>
                <span>Agregar este evento a Google Calendar</span>
              </button>
              <button
                onClick={() => setSelectedEvent(null)}
                className="w-full px-4 py-2.5 bg-bg-primary hover:bg-bg-tertiary text-text-primary border border-border-custom text-xs font-bold rounded-xl transition cursor-pointer"
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

