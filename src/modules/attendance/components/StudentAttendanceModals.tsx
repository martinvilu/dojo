"use client";
import React from "react";
import QrScannerModal from "./QrScannerModal";

export function StudentAttendanceModals(props: any) {
  const {
    profile,
    isQrScannerOpen,
    setIsQrScannerOpen,
    setApiLoading,
    setStudentAttendanceGeoLoading,
    api,
    showToast,
    studentActiveAttendanceClass,
    setStudentActiveAttendanceClass,
    studentQrToken,
    setStudentQrToken,
    selectedCourse,
    studentAttendanceGeoLoading,
    handleSubmitStudentAttendanceQr
  } = props;

  return (
    <>
      {/* Student live QR Scanner Modal */}
      {isQrScannerOpen && (
        <QrScannerModal
          onClose={() => setIsQrScannerOpen(false)}
          onScanSuccess={async (scannedData) => {
            setIsQrScannerOpen(false);
            setApiLoading(true);
            setStudentAttendanceGeoLoading(true);
            
            let lat: number | null = null;
            let lng: number | null = null;
            
            if (navigator.geolocation) {
              try {
                const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                  navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
                });
                lat = pos.coords.latitude;
                lng = pos.coords.longitude;
              } catch (err) {
                console.warn("Geolocation unavailable or denied:", err);
              }
            }
            
            setStudentAttendanceGeoLoading(false);
            
            try {
              await api("submitQrAttendance", {
                courseId: scannedData.courseId,
                classNumber: scannedData.classNumber,
                token: scannedData.token,
                lat,
                lng
              });
              showToast("¡Asistencia registrada con éxito! Ya estás presente.", "success");
            } catch (err: any) {
              showToast("Error al registrar asistencia: " + err.message, "error");
            } finally {
              setApiLoading(false);
            }
          }}
        />
      )}

      {/* Floating Action Button (FAB) for student QR scanner */}
      {profile?.role === "student" && !isQrScannerOpen && (
        <button
          type="button"
          onClick={() => setIsQrScannerOpen(true)}
          className="fixed bottom-6 right-6 md:bottom-8 md:right-8 bg-emerald-600 hover:bg-emerald-500 text-white p-4 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 z-40 border border-emerald-500/30 group cursor-pointer"
          title="Escanear QR de Asistencia"
          aria-label="Escanear QR de Asistencia"
        >
          <span className="text-xl">📷</span>
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out text-xs font-bold font-sans ml-0 group-hover:ml-2 whitespace-nowrap">
            Escanear Asistencia
          </span>
        </button>
      )}

      {/* Student QR / Code Attendance Modal */}
      {studentActiveAttendanceClass !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl max-w-sm w-full min-w-[280px] sm:min-w-[380px] shrink-0 mx-auto text-center space-y-5 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white">Firmar Presente (Clase {studentActiveAttendanceClass})</h3>
            <p className="text-xs text-gray-400">
              Ingresá el código de 6 caracteres que se muestra en la pantalla del profesor. Se requiere acceso a tu ubicación.
            </p>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Ej: A1B2C3"
                value={studentQrToken}
                onChange={(e) => setStudentQrToken(e.target.value.toUpperCase())}
                maxLength={6}
                className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-3 text-center text-xl tracking-[0.2em] font-bold text-white focus:outline-none focus:border-blue-500 font-sans"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStudentActiveAttendanceClass(null);
                    setStudentQrToken("");
                  }}
                  className="flex-1 px-4 py-2 bg-neutral-850 hover:bg-neutral-800 border border-neutral-800 text-xs font-bold text-gray-300 rounded-xl transition cursor-pointer font-sans"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={studentQrToken.length !== 6 || studentAttendanceGeoLoading}
                  onClick={() => handleSubmitStudentAttendanceQr(studentActiveAttendanceClass)}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition cursor-pointer font-sans"
                >
                  {studentAttendanceGeoLoading ? "Obteniendo ubicación..." : "Firmar Presente"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
