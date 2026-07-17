"use client";

import React, { useState } from "react";

interface ClassInstance {
  date: string;
  type: string;
  topic: string;
  special_status: "Normal" | "Clase Remota" | "Examen" | "Feriado";
  description?: string;
  classNumber?: number;
}

interface Assignment {
  id: string;
  title: string;
  due_date?: string;
  description?: string;
}

interface CalendarPanelProps {
  classes: ClassInstance[];
  assignments: Assignment[];
  activeCourseName: string;
}

export default function CalendarPanel({
  classes,
  assignments,
  activeCourseName,
}: CalendarPanelProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

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
    classes.forEach((c) => {
      if (c.date === dateStr) {
        dayEvents.push({
          type: "class",
          title: c.topic || c.type || `Clase ${c.classNumber}`,
          special_status: c.special_status || "Normal",
          details: c,
        });
      }
    });

    // Assignments on this date
    assignments.forEach((a) => {
      if (a.due_date && a.due_date.startsWith(dateStr)) {
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

    // Days in current month
    const totalDays = lastDayOfMonth.getDate();
    
    // Day of the week of first day (0 = Sun, 1 = Mon, ..., 6 = Sat)
    // Adjust to starting on Monday (0 = Mon, ..., 6 = Sun)
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek < 0) startDayOfWeek = 6;

    const monthDays: { date: Date; isCurrentMonth: boolean }[] = [];

    // Days from previous month to fill the first week
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      monthDays.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }

    // Days of current month
    for (let i = 1; i <= totalDays; i++) {
      monthDays.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Days from next month to fill the last week (grid of 42 cells)
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
    const currentDay = currentDate.getDay(); // 0 = Sun, 1 = Mon, etc.
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

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const weekdayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-neutral-900/40 p-4 rounded-2xl border border-neutral-800/80">
        <div>
          <h2 className="text-xl font-bold text-white">Cronograma & Calendario</h2>
          <p className="text-xs text-gray-400 mt-1">Cátedra activa: <strong className="text-blue-400 font-semibold">{activeCourseName}</strong></p>
        </div>
        <div className="flex items-center space-x-2 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
          <button
            onClick={() => setViewMode("month")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              viewMode === "month" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            Vista Mensual
          </button>
          <button
            onClick={() => setViewMode("week")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              viewMode === "week" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            Vista Semanal
          </button>
        </div>
      </div>

      {/* Calendar Header Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center space-x-2">
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
            className="p-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-gray-300 transition cursor-pointer text-xs"
          >
            ◀ Anterior
          </button>
          <button
            onClick={handleToday}
            className="px-3 py-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-bold text-white transition cursor-pointer"
          >
            Hoy
          </button>
          <button
            onClick={handleNext}
            className="p-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-gray-300 transition cursor-pointer text-xs"
          >
            Siguiente ▶
          </button>
        </div>
      </div>

      {/* MONTH VIEW GRID */}
      {viewMode === "month" && (
        <div className="bg-neutral-950 border border-neutral-800/80 rounded-2xl overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-neutral-850 bg-neutral-900/40 text-center py-2 text-xs font-semibold text-gray-400 select-none">
            {weekdayNames.map((name) => (
              <div key={name} className="py-1">
                {name}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 grid-rows-6 divide-x divide-y divide-neutral-900/60 border-t border-neutral-900/60">
            {getMonthDays().map(({ date, isCurrentMonth }, idx) => {
              const dateStr = toLocalDateString(date);
              const dayEvents = getEventsForDate(dateStr);
              const isToday = toLocalDateString(new Date()) === dateStr;

              return (
                <div
                  key={idx}
                  className={`min-h-[100px] p-2 flex flex-col justify-between transition-colors ${
                    isCurrentMonth ? "bg-neutral-950" : "bg-neutral-950/20 text-gray-600"
                  } ${isToday ? "ring-1 ring-blue-500/50 bg-blue-950/5" : ""}`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span
                      className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ${
                        isToday
                          ? "bg-blue-600 text-white"
                          : isCurrentMonth
                          ? "text-gray-300"
                          : "text-gray-600"
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
                          badgeClass = "bg-amber-950/60 text-amber-400 border-amber-800/40";
                        } else if (evt.special_status === "Examen") {
                          badgeClass = "bg-purple-950/60 text-purple-400 border-purple-800/40";
                        } else if (evt.special_status === "Feriado") {
                          badgeClass = "bg-red-950/60 text-red-400 border-red-800/40 line-through";
                        } else {
                          badgeClass = "bg-green-950/60 text-green-400 border-green-800/40";
                        }
                      } else {
                        // assignment
                        badgeClass = "bg-pink-955/60 text-pink-400 border-pink-800/40 font-semibold";
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
                className={`bg-neutral-950/70 border rounded-2xl p-4 flex flex-col space-y-3 transition-all ${
                  isToday ? "border-blue-500 ring-1 ring-blue-500/25 bg-blue-950/5" : "border-neutral-800/80"
                }`}
              >
                <div className="border-b border-neutral-850 pb-2 flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      {weekdayNames[idx]}
                    </h4>
                    <span className="text-lg font-black text-white">{date.getDate()}</span>
                  </div>
                  {isToday && (
                    <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-[9px] font-bold uppercase tracking-wider">
                      Hoy
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  {dayEvents.map((evt, eIdx) => {
                    let badgeClass = "bg-neutral-900 border-neutral-800 hover:border-neutral-700";
                    let titleColor = "text-white";
                    if (evt.type === "class") {
                      if (evt.special_status === "Clase Remota") {
                        badgeClass = "bg-amber-955/20 border-amber-900/40 hover:bg-amber-955/35";
                        titleColor = "text-amber-400";
                      } else if (evt.special_status === "Examen") {
                        badgeClass = "bg-purple-955/20 border-purple-900/40 hover:bg-purple-955/35";
                        titleColor = "text-purple-400";
                      } else if (evt.special_status === "Feriado") {
                        badgeClass = "bg-red-955/20 border-red-909/40 opacity-60 line-through";
                        titleColor = "text-red-400";
                      } else {
                        badgeClass = "bg-green-955/20 border-green-900/40 hover:bg-green-955/35";
                        titleColor = "text-green-400";
                      }
                    } else {
                      badgeClass = "bg-pink-955/20 border-pink-900/40 hover:bg-pink-955/35";
                      titleColor = "text-pink-400";
                    }

                    return (
                      <div
                        key={eIdx}
                        onClick={() => setSelectedEvent(evt)}
                        className={`p-3 rounded-xl border transition hover:scale-[1.02] cursor-pointer space-y-1.5 text-left ${badgeClass}`}
                      >
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block">
                          {evt.type === "assignment" ? "Entrega" : "Clase"}
                        </span>
                        <h5 className={`text-xs font-bold leading-tight ${titleColor}`}>
                          {evt.title}
                        </h5>
                      </div>
                    );
                  })}

                  {dayEvents.length === 0 && (
                    <p className="text-[10px] text-gray-600 italic text-center py-6">Sin eventos</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EVENT DETAIL MODAL */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl max-w-sm w-full space-y-5 shadow-2xl relative text-left">
            <button
              onClick={() => setSelectedEvent(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition text-lg p-1.5 focus:outline-none"
            >
              ✕
            </button>

            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">
              {selectedEvent.type === "assignment" ? "📝 Entrega de Tarea" : "📅 Sesión de Clase"}
            </span>

            <div className="space-y-1">
              <h3 className="text-base font-black text-white">{selectedEvent.title}</h3>
              {selectedEvent.type === "class" && (
                <div className="flex gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-[10px] font-bold text-gray-400 font-mono">
                    Clase {selectedEvent.details.classNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-[10px] font-bold text-gray-400">
                    Tipo: {selectedEvent.details.type || "Normal"}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2 border-t border-neutral-850 pt-3 text-xs text-gray-300">
              {selectedEvent.type === "class" ? (
                <>
                  <p><strong>Fecha:</strong> {selectedEvent.details.date || "-"}</p>
                  {selectedEvent.details.description && (
                    <div className="mt-2 bg-neutral-950 p-3 rounded-xl border border-neutral-850 max-h-36 overflow-y-auto">
                      <p className="text-[11px] text-gray-400 font-sans leading-relaxed">
                        {selectedEvent.details.description}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p><strong>Fecha Límite:</strong> {selectedEvent.details.due_date ? new Date(selectedEvent.details.due_date).toLocaleString("es-AR") : "-"}</p>
                  {selectedEvent.details.description && (
                    <div className="mt-2 bg-neutral-950 p-3 rounded-xl border border-neutral-850 max-h-36 overflow-y-auto">
                      <p className="text-[11px] text-gray-400 font-sans leading-relaxed">
                        {selectedEvent.details.description}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <button
              onClick={() => setSelectedEvent(null)}
              className="w-full px-4 py-2.5 bg-neutral-800 hover:bg-neutral-750 text-gray-300 border border-neutral-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
