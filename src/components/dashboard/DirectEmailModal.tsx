"use client";

import React, { useState } from "react";

interface DirectEmailModalProps {
  student: { id: string; full_name?: string; email?: string; matricula_unrn?: string } | null;
  courseName: string;
  courseId: string;
  onClose: () => void;
  api: (action: string, payload?: any) => Promise<any>;
}

export default function DirectEmailModal({
  student,
  courseName,
  courseId,
  onClose,
  api
}: DirectEmailModalProps) {
  const [subject, setSubject] = useState(`Mensaje de Cátedra ${courseName}`);
  const [messageBody, setMessageBody] = useState("");
  const [sending, setSending] = useState(false);

  if (!student) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageBody.trim()) {
      alert("Ingresá el mensaje a enviar.");
      return;
    }

    setSending(true);
    try {
      await api("sendDirectStudentEmail", {
        studentId: student.id,
        courseId,
        subject,
        bodyHtml: messageBody
      });
      alert(`¡Email enviado exitosamente a ${student.full_name || student.email}!`);
      onClose();
    } catch (err: any) {
      alert("Error al enviar email directo: " + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl max-w-lg w-full space-y-4 shadow-2xl">
        <div className="flex justify-between items-start border-b border-neutral-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <span>✉️ Enviar Correo Directo a Alumno</span>
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Destinatario: <strong className="text-white">{student.full_name || "Estudiante"}</strong> ({student.email || "Sin email público"})
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm font-bold">✕</button>
        </div>

        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Asunto</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Mensaje</label>
            <textarea
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              rows={6}
              placeholder="Escribí aquí tu mensaje directo para el estudiante..."
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-4 text-xs text-white focus:outline-none focus:border-blue-500 font-sans leading-relaxed"
              required
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-gray-300 text-xs font-bold rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={sending}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1 cursor-pointer"
            >
              <span>{sending ? "Enviando..." : "✉️ Enviar Correo Directo"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
