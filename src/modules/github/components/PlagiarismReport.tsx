"use client";

/** Resultado de `detectAssignmentPlagiarism`: pares de entregas y su similitud. */
export function PlagiarismReport({ report }: { report: any }) {
  return (
    <div className="md:col-span-2 bg-neutral-950/60 border border-neutral-850 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
          Análisis de similitud — {report.analyzedCount} entregas analizadas
        </h5>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${report.flaggedCount > 0 ? "bg-red-500/20 text-red-300" : "bg-green-500/20 text-green-300"}`}>
          {report.flaggedCount} par(es) sospechosos (umbral {report.threshold}%)
        </span>
      </div>
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {report.pairs.map((pair: any, idx: number) => (
          <div key={idx} className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg border text-[11px] ${pair.flagged ? "bg-red-950/30 border-red-900/50" : "bg-neutral-900 border-neutral-850"}`}>
            <span className="text-gray-300">
              <strong>{pair.a.name}</strong> ↔ <strong>{pair.b.name}</strong>
            </span>
            <span className="flex items-center gap-2 font-mono">
              <span className={pair.flagged ? "text-red-300 font-bold" : "text-gray-400"}>{pair.score}%</span>
              <span className="text-[9px] text-gray-600">jac {pair.jaccard}% · cont {pair.containment}%</span>
              {pair.flagged && <span className="text-[9px] font-bold uppercase text-red-400">⚠ Copia probable</span>}
              <a href={pair.a.repo} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">A ↗</a>
              <a href={pair.b.repo} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">B ↗</a>
            </span>
          </div>
        ))}
        {report.pairs.length === 0 && (
          <p className="text-[11px] text-gray-500 italic">No hay pares comparables (se necesitan al menos dos entregas con repositorio).</p>
        )}
        {report.skipped?.length > 0 && (
          <details className="pt-1">
            <summary className="text-[10px] text-gray-500 cursor-pointer">Entregas omitidas ({report.skipped.length})</summary>
            <ul className="mt-1 space-y-0.5">
              {report.skipped.map((sk: any, i: number) => (
                <li key={i} className="text-[10px] text-gray-600">• {sk.student}: {sk.reason}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
