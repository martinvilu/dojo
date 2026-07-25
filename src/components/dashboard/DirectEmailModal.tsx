"use client";

import React, { useState } from "react";
import { BaseModal } from "./ui";

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
    <BaseModal
      isOpen={!!student}
      onClose={onClose}
      title="Enviar Correo Directo a Alumno"
      icon="✉️"
      subtitle={
        <span>
          Destinatario: <strong className="text-blue-400">{student.full_name || "Estudiante"}</strong> ({student.email || "Sin email público"})
        </span>
      }
      modalId="email-modal"
    >
      <form onSubmit={handleSend} className="space-y-4 w-full">
        <div className="w-full">
          <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Asunto</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500 transition"
            required
          />
        </div>

        <div className="w-full">
          <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Mensaje</label>
          <textarea
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            rows={6}
            placeholder="Escribí aquí tu mensaje directo para el estudiante..."
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white font-sans leading-relaxed focus:outline-none focus:border-blue-500 transition"
            required
          />
        </div>

        <div className="flex justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-750 text-gray-300 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={sending}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 cursor-pointer shadow-lg shadow-blue-500/20 disabled:opacity-50"
          >
            <span>{sending ? "Enviando..." : "✉️ Enviar Correo Directo"}</span>
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
