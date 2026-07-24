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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card-academic max-w-lg w-full space-y-4 shadow-xl rounded-lg">
        <div className="flex justify-between items-start border-b border-border-custom pb-3">
          <div>
            <h3 className="text-base font-bold text-text-primary flex items-center space-x-2">
              <span>✉️ Enviar Correo Directo a Alumno</span>
            </h3>
            <p className="text-xs text-text-secondary mt-1">
              Destinatario: <strong className="text-text-primary">{student.full_name || "Estudiante"}</strong> ({student.email || "Sin email público"})
            </p>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary text-sm font-bold cursor-pointer">✕</button>
        </div>

        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1 uppercase tracking-wider">Asunto</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="input-academic w-full font-mono text-xs"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1 uppercase tracking-wider">Mensaje</label>
            <textarea
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              rows={6}
              placeholder="Escribí aquí tu mensaje directo para el estudiante..."
              className="input-academic w-full text-xs font-sans leading-relaxed"
              required
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={sending}
              className="btn-primary"
            >
              <span>{sending ? "Enviando..." : "✉️ Enviar Correo Directo"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
