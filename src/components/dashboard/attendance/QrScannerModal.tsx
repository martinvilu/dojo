"use client";

import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface CameraDevice {
  id: string;
  label: string;
}

interface QrScannerModalProps {
  onClose: () => void;
  onScanSuccess: (data: { courseId: string; classNumber: number; token: string }) => void;
  onScanError?: (error: string) => void;
}

export default function QrScannerModal({
  onClose,
  onScanSuccess,
  onScanError,
}: QrScannerModalProps) {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [scannerError, setScannerError] = useState<string>("");
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const qrReaderRef = useRef<HTMLDivElement>(null);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    // 1. Get available cameras
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices as any[]);
          // Prefer back camera if available
          const backCam = devices.find((device) =>
            device.label.toLowerCase().includes("back") ||
            device.label.toLowerCase().includes("trasera") ||
            device.label.toLowerCase().includes("environment")
          );
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        } else {
          setScannerError("No se encontraron cámaras en este dispositivo.");
        }
      })
      .catch((err) => {
        console.error("Error getting cameras", err);
        setScannerError("Permiso de cámara denegado o no disponible.");
      });

    return () => {
      // Cleanup: stop scanning if active
      if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
        html5QrcodeRef.current
          .stop()
          .catch((err) => console.error("Error stopping scanner on unmount", err));
      }
    };
  }, []);

  useEffect(() => {
    if (selectedCameraId && qrReaderRef.current) {
      startScanner(selectedCameraId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCameraId]);

  const startScanner = async (cameraId: string) => {
    try {
      setScannerError("");
      setIsScanning(false);

      // Stop existing scanner if running
      if (html5QrcodeRef.current) {
        if (html5QrcodeRef.current.isScanning) {
          await html5QrcodeRef.current.stop();
        }
      } else {
        html5QrcodeRef.current = new Html5Qrcode("qr-scanner-element");
      }

      setIsScanning(true);
      await html5QrcodeRef.current.start(
        cameraId,
        {
          fps: 10,
          qrbox: (width, height) => {
            const size = Math.min(width, height) * 0.7;
            return { width: size, height: size };
          },
        },
        (decodedText) => {
          // Success callback
          handleDecodedText(decodedText);
        },
        (errorMessage) => {
          // Silent verbose errors during scanning
        }
      );
    } catch (err: any) {
      console.error("Failed to start scanner", err);
      setScannerError("Error al iniciar la cámara: " + (err.message || err));
      setIsScanning(false);
    }
  };

  const handleDecodedText = (text: string) => {
    try {
      // Stop scanner immediately on success
      if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
        html5QrcodeRef.current.stop().catch((e) => console.error("Error stopping on success", e));
      }

      // Try to parse the QR data
      // Expected format: {"courseId":"...","classNumber":1,"token":"..."}
      const data = JSON.parse(text);
      if (data && data.courseId && data.classNumber && data.token) {
        onScanSuccess({
          courseId: data.courseId,
          classNumber: Number(data.classNumber),
          token: data.token.toString().trim().toUpperCase(),
        });
      } else {
        throw new Error("Formato de QR no válido.");
      }
    } catch (err: any) {
      const errorMsg = "Código QR inválido. Asegurate de escanear el código QR provisto por el profesor.";
      if (onScanError) onScanError(errorMsg);
      setScannerError(errorMsg);
      // Restart scanner after a short delay
      setTimeout(() => {
        if (selectedCameraId) startScanner(selectedCameraId);
      }, 3000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-55 p-4 animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl max-w-sm w-full text-center space-y-5 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition text-lg p-1.5 focus:outline-none"
        >
          ✕
        </button>

        <h3 className="text-lg font-bold text-white flex items-center justify-center gap-2">
          <span>📷</span> Escanear Asistencia QR
        </h3>
        
        <p className="text-xs text-gray-400">
          Enfocá el código QR proyectado por el profesor. Se requiere permitir acceso a la cámara y a tu ubicación GPS.
        </p>

        {/* Scanner window wrapper */}
        <div className="relative aspect-square w-full max-w-[280px] mx-auto bg-neutral-950 border border-neutral-850 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
          <div id="qr-scanner-element" className="w-full h-full" ref={qrReaderRef}></div>
          
          {/* Neon overlay indicator */}
          {isScanning && !scannerError && (
            <div className="absolute inset-0 pointer-events-none border-2 border-emerald-500/20 rounded-2xl">
              <div className="w-full h-0.5 bg-emerald-500 shadow-[0_0_8px_#10b981] absolute top-0 left-0 animate-scanner-line"></div>
              {/* Corner brackets */}
              <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-emerald-400"></div>
              <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-emerald-400"></div>
              <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-emerald-400"></div>
              <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-emerald-400"></div>
            </div>
          )}

          {scannerError && (
            <div className="absolute inset-0 bg-neutral-950/90 flex flex-col items-center justify-center p-4 text-center space-y-2 z-10">
              <span className="text-2xl">⚠️</span>
              <p className="text-xs text-red-400 font-semibold">{scannerError}</p>
              <button
                type="button"
                onClick={() => selectedCameraId && startScanner(selectedCameraId)}
                className="mt-2 px-3 py-1 bg-neutral-800 hover:bg-neutral-750 text-white text-[10px] font-bold rounded-lg border border-neutral-700 transition"
              >
                Reintentar
              </button>
            </div>
          )}
        </div>

        {/* Camera Selector */}
        {cameras.length > 1 && !scannerError && (
          <div className="space-y-1 text-left">
            <label className="block text-[9px] text-gray-500 font-bold uppercase tracking-wider">Cámara seleccionada</label>
            <select
              value={selectedCameraId}
              onChange={(e) => setSelectedCameraId(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-gray-300 font-semibold cursor-pointer"
            >
              {cameras.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.label || `Cámara ${device.id.substring(0, 5)}`}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-neutral-800 hover:bg-neutral-750 text-gray-300 border border-neutral-700 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
