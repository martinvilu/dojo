import React, { useState } from "react";

interface Tutor {
  id: string;
  user_id: string;
  user_name: string;
  email: string;
  topics: string;
  availability: string;
}

interface TutoringSession {
  id: string;
  tutor_id: string;
  student_id: string;
  tutor_name: string;
  student_name: string;
  topic: string;
  date_time: string;
  status: "requested" | "confirmed" | "cancelled";
  meeting_link?: string;
}

interface TutoringPanelProps {
  courseId: string;
  tutors: Tutor[];
  setTutors: React.Dispatch<React.SetStateAction<Tutor[]>>;
  tutoringSessions: TutoringSession[];
  setTutoringSessions: React.Dispatch<React.SetStateAction<TutoringSession[]>>;
  currentUser: { uid: string; email?: string | null; displayName?: string | null } | null;
  api: (action: string, payload?: any) => Promise<any>;
}

export default function TutoringPanel({
  courseId,
  tutors,
  setTutors,
  tutoringSessions,
  setTutoringSessions,
  currentUser,
  api,
}: TutoringPanelProps) {
  // Modals state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [selectedTutor, setSelectedTutor] = useState<Tutor | null>(null);

  // Form states
  const [tutorTopics, setTutorTopics] = useState("");
  const [tutorAvailability, setTutorAvailability] = useState("");
  const [bookingTopic, setBookingTopic] = useState("");
  const [bookingDateTime, setBookingDateTime] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegisterAsTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tutorTopics.trim() || !tutorAvailability.trim()) {
      alert("Por favor completa los temas y la disponibilidad.");
      return;
    }
    setLoading(true);
    try {
      await api("registerAsTutor", {
        courseId,
        topics: tutorTopics,
        availability: tutorAvailability,
      });
      alert("Te registraste como tutor exitosamente.");
      setTutorTopics("");
      setTutorAvailability("");
      setIsRegisterModalOpen(false);

      const tutorsList = await api("getCourseTutors", { courseId });
      setTutors(tutorsList || []);
    } catch (err: any) {
      alert("Error al registrarse como tutor: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBookSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTutor) return;
    if (!bookingDateTime || !bookingTopic.trim()) {
      alert("Por favor especifica la fecha/hora y el tema.");
      return;
    }
    setLoading(true);
    try {
      await api("bookTutoringSession", {
        courseId,
        tutorId: selectedTutor.user_id,
        dateTime: bookingDateTime,
        topic: bookingTopic,
      });
      alert("Mentoría reservada con éxito. Se ha generado un enlace a la sala.");
      setBookingDateTime("");
      setBookingTopic("");
      setSelectedTutor(null);
      setIsBookModalOpen(false);

      const studentSessions = await api("getTutoringSessions", { courseId, role: "student" }).catch(() => []);
      const tutorSessions = await api("getTutoringSessions", { courseId, role: "tutor" }).catch(() => []);
      const uniqueSessions = [...(studentSessions || []), ...(tutorSessions || [])]
        .filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i);
      setTutoringSessions(uniqueSessions);
    } catch (err: any) {
      alert("Error al reservar sesión: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (sessionId: string, newStatus: string) => {
    setLoading(true);
    try {
      await api("updateTutoringSessionStatus", { sessionId, status: newStatus });
      alert(`Sesión de mentoría ${newStatus === "confirmed" ? "confirmada" : "cancelada"}.`);

      const studentSessions = await api("getTutoringSessions", { courseId, role: "student" }).catch(() => []);
      const tutorSessions = await api("getTutoringSessions", { courseId, role: "tutor" }).catch(() => []);
      const uniqueSessions = [...(studentSessions || []), ...(tutorSessions || [])]
        .filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i);
      setTutoringSessions(uniqueSessions);
    } catch (err: any) {
      alert("Error al actualizar estado: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Header with Actions */}
      <div className="flex justify-between items-center border-b border-neutral-900 pb-4">
        <div>
          <h3 className="text-base font-bold text-white">🎓 Tutorías Académicas entre Pares</h3>
          <p className="text-xs text-gray-400">
            Postulate como tutor para orientar a tus compañeros o reserva una mentoría 1-a-1.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsRegisterModalOpen(true)}
          className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-amber-500 text-xs font-bold rounded-xl transition cursor-pointer"
        >
          🤝 Postularme como Tutor
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Available Tutors */}
        <div className="lg:col-span-2 space-y-4">
          <h4 className="font-bold text-white text-sm">Tutores Disponibles ({tutors.length})</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tutors.map((tutor) => (
              <div
                key={tutor.id}
                className="bg-neutral-900/40 p-5 rounded-2xl border border-neutral-800 flex flex-col justify-between gap-4 text-left"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 font-bold text-xs">
                      {tutor.user_name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-white">{tutor.user_name}</h5>
                      <p className="text-[10px] text-gray-400">{tutor.email}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-gray-400 block mb-1">Temas Fuertes:</span>
                    <p className="text-xs text-gray-300">{tutor.topics}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-gray-400 block mb-1">Disponibilidad:</span>
                    <p className="text-xs text-gray-300">{tutor.availability}</p>
                  </div>
                </div>

                {tutor.user_id !== currentUser?.uid ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTutor(tutor);
                      setIsBookModalOpen(true);
                    }}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer text-center"
                  >
                    Reservar Mentoría
                  </button>
                ) : (
                  <div className="w-full py-2 bg-neutral-950 text-gray-500 text-xs font-medium rounded-xl text-center">
                    Tu perfil de Tutor
                  </div>
                )}
              </div>
            ))}

            {tutors.length === 0 && (
              <div className="col-span-2 bg-neutral-900/10 border border-dashed border-neutral-800 p-8 rounded-2xl text-center text-gray-500 text-xs leading-relaxed">
                No hay tutores registrados todavía en esta materia. ¡Postulate como tutor!
              </div>
            )}
          </div>
        </div>

        {/* My Booked Sessions */}
        <div className="lg:col-span-1 bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4 text-left">
          <h4 className="font-bold text-white text-sm">📅 Mis Tutorías y Mentorías</h4>
          <div className="space-y-3">
            {tutoringSessions.map((session) => {
              const isUserTutor = session.tutor_id === currentUser?.uid;
              const dateObj = new Date(session.date_time);
              const dateStr = dateObj.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
              return (
                <div
                  key={session.id}
                  className="bg-neutral-950 p-4 rounded-xl border border-neutral-850 space-y-3 text-xs"
                >
                  <div className="flex justify-between items-start">
                    <span
                      className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                        isUserTutor
                          ? "bg-amber-950 text-amber-400 border border-amber-900"
                          : "bg-blue-950 text-blue-400 border border-blue-900"
                      }`}
                    >
                      {isUserTutor ? "Como Mentor" : "Como Estudiante"}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                        session.status === "confirmed"
                          ? "bg-green-950 text-green-400 border border-green-900"
                          : session.status === "requested"
                          ? "bg-amber-950 text-amber-400 border border-amber-900"
                          : "bg-red-950 text-red-400 border border-red-900"
                      }`}
                    >
                      {session.status === "confirmed"
                        ? "Confirmada"
                        : session.status === "requested"
                        ? "Pendiente"
                        : "Cancelada"}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <p className="text-gray-400 font-semibold">
                      {isUserTutor ? `Alumno: ${session.student_name}` : `Mentor: ${session.tutor_name}`}
                    </p>
                    <p className="text-white text-xs font-bold">{session.topic}</p>
                    <p className="text-gray-400 text-[10px]">Fecha: {dateStr}</p>
                  </div>

                  {session.status === "confirmed" && session.meeting_link && (
                    <a
                      href={session.meeting_link}
                      target="_blank"
                      rel="noreferrer"
                      className="block w-full py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-center font-bold text-[10px] transition"
                    >
                      🎥 Entrar a Sala Virtual
                    </a>
                  )}

                  {session.status === "requested" && isUserTutor && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(session.id, "confirmed")}
                        className="flex-1 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-center font-bold text-[10px] cursor-pointer transition"
                      >
                        Aceptar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(session.id, "cancelled")}
                        className="flex-1 py-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 rounded-lg text-center font-bold text-[10px] cursor-pointer transition"
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {tutoringSessions.length === 0 && (
              <p className="text-xs text-gray-500 italic py-2">No tienes tutorías agendadas.</p>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: REGISTER AS TUTOR */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
          <form
            onSubmit={handleRegisterAsTutor}
            className="bg-neutral-900 border border-neutral-800 w-full max-w-md p-6 rounded-2xl space-y-4 text-left shadow-2xl"
          >
            <h3 className="font-bold text-white text-sm">🤝 Registro como Tutor Académico</h3>
            <p className="text-xs text-gray-400">
              Ingresa los temas en los que tienes buen dominio y tu disponibilidad horaria.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Temas Fuertes
                </label>
                <input
                  type="text"
                  placeholder="Ej: React, Hooks, TypeScript"
                  value={tutorTopics}
                  onChange={(e) => setTutorTopics(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Disponibilidad Horaria
                </label>
                <input
                  type="text"
                  placeholder="Ej: Lunes y Miércoles después de las 18hs"
                  value={tutorAvailability}
                  onChange={(e) => setTutorAvailability(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(false)}
                className="flex-1 px-4 py-2 bg-neutral-850 hover:bg-neutral-800 border border-neutral-800 text-xs font-bold text-gray-300 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Postularme
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: BOOK TUTORING SESSION */}
      {isBookModalOpen && selectedTutor && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
          <form
            onSubmit={handleBookSession}
            className="bg-neutral-900 border border-neutral-800 w-full max-w-md p-6 rounded-2xl space-y-4 text-left shadow-2xl"
          >
            <h3 className="font-bold text-white text-sm">📅 Reservar Sesión de Mentoría</h3>
            <p className="text-xs text-gray-400">
              Reservando una sesión con <strong>{selectedTutor.user_name}</strong>.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Tema de la Consulta
                </label>
                <input
                  type="text"
                  placeholder="Ej: Dudas con el laboratorio de React"
                  value={bookingTopic}
                  onChange={(e) => setBookingTopic(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Fecha y Hora sugerida
                </label>
                <input
                  type="datetime-local"
                  value={bookingDateTime}
                  onChange={(e) => setBookingDateTime(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsBookModalOpen(false);
                  setSelectedTutor(null);
                }}
                className="flex-1 px-4 py-2 bg-neutral-850 hover:bg-neutral-800 border border-neutral-800 text-xs font-bold text-gray-300 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Reservar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
