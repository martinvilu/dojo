"use client";

interface AdminBackupsSectionProps {
  systemBackups: any[];
  courses: any[];
  assignments: any[];
  users: any[];
  onCreateBackup: () => void;
  onDownloadBackup: (backupId: string) => void;
  onRestoreBackupDocument: (backupId: string, collectionName: string, docId: string) => void;
}

export function AdminBackupsSection({
  systemBackups, courses, assignments, users,
  onCreateBackup, onDownloadBackup, onRestoreBackupDocument
}: AdminBackupsSectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Respaldos Incrementales y Recuperación Granular</h2>
          <p className="text-xs text-gray-400">Creá puntos de restauración del sistema y recuperá documentos individuales de Firestore.</p>
        </div>
        <button
          onClick={onCreateBackup}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
        >
          💾 Crear Respaldo Completo Ahora
        </button>
      </div>

      <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-6 space-y-6">
        <h3 className="text-base font-bold text-white">Respaldos Guardados ({systemBackups.length})</h3>

        <div className="space-y-4">
          {systemBackups.map((b) => (
            <div key={b.id} className="bg-neutral-950/60 border border-neutral-850 p-5 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-border-custom pb-3 gap-2">
                <div>
                  <span className="text-[10px] text-text-secondary font-mono">ID: {b.id}</span>
                  <p className="text-sm font-bold text-text-primary">Fecha: {new Date(b.created_at).toLocaleString()}</p>
                  <p className="text-xs text-text-secondary">Creado por: {b.created_by_name}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex gap-2 text-[11px]">
                    <span className="bg-bg-tertiary px-3 py-1 rounded-full text-text-secondary">{b.courses_count} Cátedras</span>
                    <span className="bg-bg-tertiary px-3 py-1 rounded-full text-text-secondary">{b.assignments_count} Tareas</span>
                    <span className="bg-bg-tertiary px-3 py-1 rounded-full text-text-secondary">{b.profiles_count} Perfiles</span>
                  </div>
                  <button
                    onClick={() => onDownloadBackup(b.id)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-xl transition cursor-pointer flex items-center space-x-1"
                    title="Descargar respaldo completo como archivo JSON"
                  >
                    <span>📥</span> <span>Descargar JSON</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Restauración Granular</h4>
                <p className="text-[11px] text-gray-500">
                  Seleccioná un elemento para revertir su estado al momento de este respaldo.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-850 space-y-2">
                    <span className="text-xs font-bold text-amber-500">Cátedras</span>
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                      {courses.map((course) => (
                        <div key={course.id} className="flex justify-between items-center bg-neutral-950 p-2 rounded-lg border border-neutral-900 text-[10px]">
                          <span className="truncate text-white max-w-[120px]">{course.name}</span>
                          <button
                            onClick={() => onRestoreBackupDocument(b.id, "courses", course.id)}
                            className="text-blue-400 hover:underline font-bold"
                          >
                            Restaurar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-850 space-y-2">
                    <span className="text-xs font-bold text-amber-500">Tareas</span>
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                      {assignments.map((asg) => (
                        <div key={asg.id} className="flex justify-between items-center bg-neutral-950 p-2 rounded-lg border border-neutral-900 text-[10px]">
                          <span className="truncate text-white max-w-[120px]">{asg.title}</span>
                          <button
                            onClick={() => onRestoreBackupDocument(b.id, "assignments", asg.id)}
                            className="text-blue-400 hover:underline font-bold"
                          >
                            Restaurar
                          </button>
                        </div>
                      ))}
                      {assignments.length === 0 && (
                        <p className="text-[10px] text-gray-500 text-center py-2">Sin tareas cargadas en UI.</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-850 space-y-2">
                    <span className="text-xs font-bold text-amber-500">Usuarios / Perfiles</span>
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                      {users.map((u) => (
                        <div key={u.id} className="flex justify-between items-center bg-neutral-950 p-2 rounded-lg border border-neutral-900 text-[10px]">
                          <span className="truncate text-white max-w-[120px]">{u.full_name || u.email}</span>
                          <button
                            onClick={() => onRestoreBackupDocument(b.id, "profiles", u.id)}
                            className="text-blue-400 hover:underline font-bold"
                          >
                            Restaurar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {systemBackups.length === 0 && (
            <div className="bg-neutral-950/20 border border-dashed border-neutral-800 p-8 rounded-2xl text-center text-gray-500 text-sm">
              No hay respaldos registrados. Presioná el botón de arriba para generar el primero.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
