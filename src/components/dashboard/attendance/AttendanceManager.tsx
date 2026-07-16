import React, { useState, useEffect } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/clientApp";

interface Student {
  id: string;
  full_name?: string;
  email: string;
  matricula_unrn?: string;
  commissions?: Record<string, string>;
}

interface AttendanceRecord {
  id: string;
  records: Record<string, "present" | "absent" | "late">;
  updated_at?: string;
}

interface AttendanceManagerProps {
  classNumber: number;
  courseId: string;
  roster: Student[];
  courseAttendance: AttendanceRecord[];
  commissions?: string[];
  onClose: () => void;
}

export default function AttendanceManager({
  classNumber,
  courseId,
  roster,
  courseAttendance,
  commissions = ["Comisión A", "Comisión B", "Comisión C", "Comisión D"],
  onClose,
}: AttendanceManagerProps) {
  // Local states
  const [commissionFilter, setCommissionFilter] = useState("Todas");
  const [editingRecords, setEditingRecords] = useState<Record<string, "present" | "absent" | "late">>({});
  const [saving, setSaving] = useState(false);

  // QR States
  const [activeQr, setActiveQr] = useState<{ code: string; expiresIn: number } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  // Initialize records from existing attendance if present
  useEffect(() => {
    const docId = `class_${classNumber}`;
    const existing = courseAttendance.find((a) => a.id === docId);
    const initialRecords: Record<string, "present" | "absent" | "late"> = {};
    roster.forEach((student) => {
      initialRecords[student.id] = existing?.records?.[student.id] || "present";
    });
    setEditingRecords(initialRecords);
  }, [classNumber, courseAttendance, roster]);

  // QR Timer
  useEffect(() => {
    if (!activeQr) return;
    const interval = setInterval(() => {
      setActiveQr((prev) => {
        if (!prev) return null;
        if (prev.expiresIn <= 1) {
          clearInterval(interval);
          return null;
        }
        return { ...prev, expiresIn: prev.expiresIn - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeQr]);

  const handleGenerateQr = async () => {
    setQrLoading(true);
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      let lat: number | null = null;
      let lng: number | null = null;

      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch (geoErr) {
          console.warn("Geolocation denied or timed out:", geoErr);
        }
      }

      const activeQrRef = doc(db, "courses", courseId, "active_qr", "current");
      await setDoc(activeQrRef, {
        token: code,
        classNumber,
        lat,
        lng,
        created_at: serverTimestamp(),
      });

      setActiveQr({
        code,
        expiresIn: 300,
      });
    } catch (err: any) {
      alert("Error al generar QR de asistencia: " + err.message);
    } finally {
      setQrLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const docRef = doc(db, "courses", courseId, "attendance", `class_${classNumber}`);
      await setDoc(
        docRef,
        {
          records: editingRecords,
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      );
      alert("Asistencia guardada con éxito.");
      onClose();
    } catch (err: any) {
      alert("Error al guardar asistencia: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredRoster = roster.filter((student) => {
    const studentComm = student.commissions?.[courseId] || "";
    if (commissionFilter === "Todas") return true;
    if (commissionFilter === "Sin Comisión") return studentComm === "";
    return studentComm === commissionFilter;
  });

  return (
    <div className="mt-4 bg-neutral-950 border border-neutral-850 p-4 rounded-xl space-y-4 text-left">
      <div className="flex justify-between items-center border-b border-neutral-850 pb-2">
        <h6 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
          Tomar Asistencia (Clase {classNumber})
        </h6>
        <div className="flex gap-2.5 items-center flex-wrap">
          <select
            value={commissionFilter}
            onChange={(e) => setCommissionFilter(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 text-[10px] rounded px-2 py-1 text-gray-300 focus:outline-none cursor-pointer font-semibold"
          >
            <option value="Todas">Todas las Comisiones</option>
            {commissions.map((comm) => (
              <option key={comm} value={comm}>{comm}</option>
            ))}
            <option value="Sin Comisión">Sin Comisión</option>
          </select>
          <button
            type="button"
            onClick={handleGenerateQr}
            disabled={qrLoading}
            className="px-2.5 py-1 bg-emerald-955/50 border border-emerald-800 text-emerald-300 hover:bg-emerald-900/50 rounded text-[10px] font-bold transition cursor-pointer disabled:opacity-50"
          >
            {qrLoading ? "Cargando..." : "🛡️ Generar QR Dinámico"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-xs cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>

      <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
        {filteredRoster.map((student) => {
          const currentVal = editingRecords[student.id] || "present";
          return (
            <div
              key={student.id}
              className="flex justify-between items-center text-xs py-1.5 border-b border-neutral-900/60 last:border-b-0"
            >
              <div className="flex flex-col">
                <span className="font-semibold text-white">{student.full_name || student.email}</span>
                <span className="text-[10px] text-gray-550 font-mono">
                  Matrícula: {student.matricula_unrn || "-"}
                </span>
              </div>
              <div className="flex bg-neutral-900 p-0.5 rounded-lg border border-neutral-800">
                <button
                  type="button"
                  onClick={() => setEditingRecords((prev) => ({ ...prev, [student.id]: "present" }))}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                    currentVal === "present" ? "bg-green-600 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Presente
                </button>
                <button
                  type="button"
                  onClick={() => setEditingRecords((prev) => ({ ...prev, [student.id]: "late" }))}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                    currentVal === "late" ? "bg-amber-600 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Tarde
                </button>
                <button
                  type="button"
                  onClick={() => setEditingRecords((prev) => ({ ...prev, [student.id]: "absent" }))}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                    currentVal === "absent" ? "bg-red-600 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Ausente
                </button>
              </div>
            </div>
          );
        })}
        {filteredRoster.length === 0 && (
          <p className="text-xs text-gray-500 italic text-center py-2">No hay estudiantes en esta comisión.</p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-neutral-850">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-850 text-gray-400 rounded-xl text-xs font-semibold transition cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>

      {/* QR Code Modal Overlay Overlay (nested inside Manager context) */}
      {activeQr && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-55 p-4">
          <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-3xl max-w-sm w-full text-center space-y-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white">Presentismo por Código QR</h3>
            <p className="text-xs text-gray-400">
              Proyecta este código en pantalla para que los alumnos lo escaneen y firmen su presente.
            </p>

            <div className="bg-white p-4 rounded-2xl inline-block shadow-inner mx-auto">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=000000&data=${encodeURIComponent(
                  JSON.stringify({
                    courseId,
                    classNumber,
                    token: activeQr.code,
                  })
                )}`}
                alt="QR Code"
                className="w-48 h-48"
              />
            </div>

            <div className="space-y-1">
              <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">Código de asistencia</span>
              <div className="text-3xl font-black text-amber-500 font-mono tracking-widest bg-neutral-955 py-2.5 rounded-xl border border-neutral-850">
                {activeQr.code}
              </div>
            </div>

            <div className="flex items-center justify-center space-x-2 text-xs font-bold text-gray-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>
                Expira en: {Math.floor(activeQr.expiresIn / 60)}:
                {(activeQr.expiresIn % 60).toString().padStart(2, "0")}
              </span>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleGenerateQr}
                className="flex-1 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-750 text-gray-300 border border-neutral-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                🔄 Renovar
              </button>
              <button
                type="button"
                onClick={() => setActiveQr(null)}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
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
