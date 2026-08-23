"use client";

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = "Cargando plataforma..." }: LoadingScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-12 h-12 border-4 border-t-blue-500 border-blue-900 rounded-full animate-spin"></div>
        <p className="text-gray-400 font-medium">{message}</p>
      </div>
    </div>
  );
}

interface PendingApprovalViewProps {
  matriculaInput: string;
  setMatriculaInput: (v: string) => void;
  matriculaError: string;
  apiLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onLogout: () => void;
}

export function PendingApprovalView({
  matriculaInput, setMatriculaInput, matriculaError, apiLoading, onSubmit, onLogout
}: PendingApprovalViewProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.05)_0%,transparent_70%)] pointer-events-none"></div>
      <div className="w-full max-w-lg bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 p-8 rounded-2xl shadow-2xl relative z-10 text-center">
        <h2 className="text-2xl font-bold text-amber-500 mb-4">Registro en Proceso de Aprobación</h2>
        <p className="text-gray-300 text-sm mb-6">
          Para acceder como estudiante, es requisito validar tu número de matrícula de la UNRN (formato <strong>UNRN-######</strong>).
        </p>

        <form onSubmit={onSubmit} className="space-y-4 max-w-md mx-auto">
          <input
            type="text"
            value={matriculaInput}
            onChange={(e) => setMatriculaInput(e.target.value)}
            placeholder="Ej: UNRN-12345"
            className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-center font-mono text-white"
            required
          />
          {matriculaError && (
            <p className="text-red-400 text-xs text-left">{matriculaError}</p>
          )}
          <button
            type="submit"
            disabled={apiLoading}
            className="w-full bg-amber-600 hover:bg-amber-500 active:bg-amber-700 transition text-white font-medium py-3 rounded-xl shadow-lg shadow-amber-500/20 text-sm disabled:opacity-55"
          >
            {apiLoading ? "Enviando..." : "Validar Matrícula"}
          </button>
        </form>

        <div className="my-6 border-t border-neutral-800"></div>

        <p className="text-gray-400 text-xs mb-6">
          ¿No sos estudiante o no tenés matrícula?<br />
          Tu cuenta quedará en espera de aprobación manual por parte de un docente o administrador.
        </p>

        <button
          onClick={onLogout}
          className="px-6 py-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-sm transition"
        >
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}
