import type { ConditionResult } from "./types";
import { CriterionStatusIcon, percent } from "./ConditionChip";

const fmt = (n: number | null) => (n === null ? "—" : String(n).replace(".", ","));

/** Desglose de criterios de regularidad y promoción con sus motivos. */
export function ConditionDetail({ result }: { result: ConditionResult }) {
  const { attendance, tps, partials } = result;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
      <section className="space-y-2">
        <h6 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Regularidad</h6>
        <ul className="space-y-1.5 text-gray-300">
          <li className="flex gap-2">
            <CriterionStatusIcon status={result.regularity.attendance} />
            <span>
              Asistencia {percent(attendance.ratio)} ({attendance.attended}/{attendance.held - attendance.justified} clases
              {attendance.justified > 0 && `, ${attendance.justified} justificadas`}) · mínimo {percent(attendance.required)}
              {attendance.waived && " · eximida"}
            </span>
          </li>
          <li className="flex gap-2">
            <CriterionStatusIcon status={result.regularity.tps} />
            <span>
              TPs obligatorios entregados: {tps.delivered}/{tps.required}
              {tps.exempt.length > 0 && ` · ${tps.exempt.length} exceptuado`}
            </span>
          </li>
          <li className="flex gap-2">
            <CriterionStatusIcon status={result.regularity.partials} />
            <span>
              Parciales aprobados (o recuperados)
              {partials.length === 0 && " · sin parciales cargados"}
            </span>
          </li>
        </ul>
      </section>
      <section className="space-y-2">
        <h6 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Promoción</h6>
        <ul className="space-y-1.5 text-gray-300">
          <li className="flex gap-2">
            <CriterionStatusIcon status={result.promotion.ok_ratio} />
            <span>TPs en OK: {tps.ok_ratio.approved} (hacen falta {tps.ok_ratio.needed})</span>
          </li>
          <li className="flex gap-2">
            <CriterionStatusIcon status={result.promotion.late} />
            <span>Fuera de término: {tps.late.count} (máximo {tps.late.max})</span>
          </li>
          <li className="flex gap-2">
            <CriterionStatusIcon status={result.promotion.partials} />
            <span>Nota de promoción en cada parcial</span>
          </li>
        </ul>
      </section>
      {partials.length > 0 && (
        <section className="md:col-span-2">
          <table className="w-full text-left">
            <thead className="text-[10px] text-gray-500 uppercase tracking-wider">
              <tr><th className="py-1 font-bold">Parcial</th><th className="font-bold">Nota</th><th className="font-bold">Recuperatorios</th><th className="font-bold">Regularidad</th><th className="font-bold">Promoción</th></tr>
            </thead>
            <tbody className="text-gray-300">
              {partials.map((p) => (
                <tr key={p.id} className="border-t border-neutral-850">
                  <td className="py-1.5 font-semibold">{p.label}</td>
                  <td>{p.absent ? "Ausente" : fmt(p.original)}</td>
                  <td>{p.recoveries.length === 0 ? "—" : p.recoveries.map((r) => `${r.label}: ${r.absent ? "Ausente" : fmt(r.value)}`).join(" · ")}</td>
                  <td><CriterionStatusIcon status={p.regularity} /></td>
                  <td><CriterionStatusIcon status={p.promotion} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {result.reasons.length > 0 && (
        <section className="md:col-span-2 bg-neutral-950 border border-neutral-850 rounded-xl p-3">
          <h6 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Motivos</h6>
          <ul className="list-disc list-inside space-y-0.5 text-gray-300">
            {result.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
