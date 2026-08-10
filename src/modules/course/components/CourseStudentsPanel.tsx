"use client";
import React from 'react';
import { api } from '@/lib/api';
import { db } from '@/lib/firebase/clientApp';
import { doc, updateDoc } from 'firebase/firestore';
import { copyToClipboard } from '@/lib/clipboard';
import { useMemo } from 'react';

export function CourseStudentsPanel({
  profile,
  selectedCourse,
  roster,
  setRoster,
  courseAttendance,
  courseSubmissions,
  assignments,
  pastDueAssignments,
  showToast,
  setApiLoading,
  commissionFilter,
  setCommissionFilter,
  setSelectedDirectEmailStudent,
  teacherClasses,
  courseCommissions,
  showCsvEndpoint,
  setShowCsvEndpoint
}: any) {
  // Pre-compute attendance and submissions statistics for O(1) lookups during render and export
  // This avoids O(N) array filtering/finding inside maps across hundreds of rows
  const { attendanceStats, submissionsByStudent } = useMemo(() => {
    const attStats = new Map();
    (courseAttendance || []).forEach((att: any) => {
      if (!att.records) return;
      Object.entries(att.records).forEach(([studentId, status]) => {
        if (!attStats.has(studentId)) {
          attStats.set(studentId, { recordedCount: 0, presentOrLate: 0 });
        }
        const stats = attStats.get(studentId);
        stats.recordedCount++;
        if (status === "present" || status === "late") {
          stats.presentOrLate++;
        }
      });
    });

    const subsByStudent = new Map();
    (courseSubmissions || []).forEach((sub: any) => {
      if (!subsByStudent.has(sub.student_id)) {
        subsByStudent.set(sub.student_id, new Map());
      }
      subsByStudent.get(sub.student_id).set(sub.assignment_id, sub);
    });

    return { attendanceStats: attStats, submissionsByStudent: subsByStudent };
  }, [courseAttendance, courseSubmissions]);

  const handleCheckAndAlertStudentsAtRisk = async () => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) return;
    setApiLoading(true);
    try {
      const res = await api("checkAndAlertStudentsAtRisk", { courseId: cid });
      showToast(`Verificación completada. Se dispararon alertas para ${res.alertsTriggeredCount} alumnos.`, "success");
    } catch (err: any) {
      showToast("Error al verificar alertas: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  const handleDownloadPDFReport = () => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) return;
    const courseName = selectedCourse?.name || selectedCourse?.course?.name || "Reporte";
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) return showToast("Por favor habilita las ventanas emergentes para descargar el reporte.", "success");
    
    const rosterHtml = roster
      .filter((s: any) => s.role === "student")
      .map((s: any) => {
        const attStats = attendanceStats.get(s.student_id) || { recordedCount: 0, presentOrLate: 0 };
        const presentCount = attStats.presentOrLate;
        const totalClasses = teacherClasses.length;
        const attendancePercent = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 100;
        
        return `
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 8px;">${s.full_name || s.email}</td>
            <td style="padding: 8px; font-family: monospace;">${s.matricula_unrn || "-"}</td>
            <td style="padding: 8px;">${attendancePercent}% (${presentCount}/${totalClasses})</td>
            <td style="padding: 8px;">${s.role === "student" ? "Regular" : s.role}</td>
          </tr>
        `;
      })
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Reporte de Cursada - ${courseName}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 40px; }
            h1 { font-size: 24px; color: #1e3a8a; margin-bottom: 5px; }
            p { font-size: 12px; color: #555; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th { background-color: #f3f4f6; text-align: left; padding: 10px; border-bottom: 2px solid #ddd; }
            .header-info { display: flex; justify-content: space-between; border-bottom: 2px solid #3b82f6; padding-bottom: 15px; }
            .metric-box { border: 1px solid #ddd; padding: 15px; border-radius: 8px; font-size: 14px; background-color: #f9fafb; width: 30%; text-align: center; }
            .metrics-container { display: flex; justify-content: space-between; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header-info">
            <div>
              <h1>Jutsu Classroom - Reporte Académico</h1>
              <h2>Cátedra: ${courseName}</h2>
              <p>Generado automáticamente el ${new Date().toLocaleDateString()} a las ${new Date().toLocaleTimeString()}</p>
            </div>
            <div style="text-align: right;">
              <p><strong>Organización GitHub:</strong> ${selectedCourse?.github_org || "Ninguna"}</p>
              <p><strong>Clases Totales:</strong> ${teacherClasses.length}</p>
            </div>
          </div>
          
          <div class="metrics-container">
            <div class="metric-box">
              <strong>Estudiantes Inscriptos</strong><br/>
              <span style="font-size: 24px; font-weight: bold; color: #2563eb;">${roster.length}</span>
            </div>
            <div class="metric-box">
              <strong>Promedio General Asistencia</strong><br/>
              <span style="font-size: 24px; font-weight: bold; color: #10b981;">
                ${roster.length > 0 ? Math.round(roster.reduce((acc: any, curr: any) => {
                  const attStats = attendanceStats.get(curr.student_id) || { presentOrLate: 0 };
                  const present = attStats.presentOrLate;
                  return acc + (teacherClasses.length > 0 ? (present / teacherClasses.length) : 1);
                }, 0) / roster.length * 100) : 100}%
              </span>
            </div>
            <div class="metric-box">
              <strong>Clases Dictadas</strong><br/>
              <span style="font-size: 24px; font-weight: bold; color: #db2777;">${teacherClasses.filter((c: any) => !c.special_status || c.special_status === "Normal").length}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Estudiante</th>
                <th>Matrícula</th>
                <th>Asistencia</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${rosterHtml}
            </tbody>
          </table>
          
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleExportGradesMatrix = () => {
    const cid = selectedCourse.id || selectedCourse.course?.id;
    if (!cid) return;
    if (roster.length === 0) {
      showToast("No hay alumnos inscriptos en esta materia todavía.", "success");
      return;
    }
    
    try {
      let csv = "Nombre,Email,Matricula,";
      assignments.forEach((a: any) => {
        csv += `"${a.title.replace(/"/g, '""')}",`;
      });
      csv += "Promedio,Asistencia,Alertas,Condicion\n";
      
      roster.forEach((student: any) => {
        if (student.role !== "student") return;
        // Name, Email, Matricula
        csv += `"${(student.full_name || "").replace(/"/g, '""')}","${student.email || ""}","${student.matricula_unrn || ""}",`;
        
        let totalGradesSum = 0;
        let gradesCount = 0;
        
        const studentSubsMap = submissionsByStudent.get(student.id) || new Map();

        // Assignments columns
        assignments.forEach((a: any) => {
          const sub = studentSubsMap.get(a.id);
          const gradeVal = sub ? sub.grade : "";
          csv += `"${(gradeVal || "").replace(/"/g, '""')}",`;
          
          const num = parseFloat(gradeVal);
          if (!isNaN(num)) {
            totalGradesSum += num;
            gradesCount++;
          }
        });
        
        // Numerical Average
        const avg = gradesCount > 0 ? (totalGradesSum / gradesCount).toFixed(2) : "-";
        
        // Attendance percentage
        const attStats = attendanceStats.get(student.id) || { recordedCount: 0, presentOrLate: 0 };
        const recordedCount = attStats.recordedCount;
        const presentOrLate = attStats.presentOrLate;
        const attendanceRate = recordedCount > 0 ? (presentOrLate / recordedCount) * 100 : 100;
        const hasCriticalAttendance = recordedCount >= 3 && attendanceRate < 75;
        
        // Missing assignments
        const hasMissingAssignments = assignments.some((a: any) => {
          const hasSub = studentSubsMap.has(a.id);
          const isPastDue = pastDueAssignments.has(a.id);
          return !hasSub && isPastDue;
        });
        
        // Alerts summary string
        const alertsArr = [];
        if (hasCriticalAttendance) alertsArr.push("Asistencia Critica");
        if (hasMissingAssignments) alertsArr.push("Tareas Atrasadas");
        const alertsStr = alertsArr.length > 0 ? alertsArr.join(" | ") : "Ninguna";
        
        // Condition status
        const cond = (hasCriticalAttendance || hasMissingAssignments) ? "EN RIESGO" : "REGULAR";
        
        csv += `"${avg}","${attendanceRate.toFixed(0)}%","${alertsStr}","${cond}"\n`;
      });
      
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `planilla_notas_y_alertas_${selectedCourse.name.replace(/\s+/g, "_")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      showToast("Error al exportar planilla: " + err.message, "error");
    }
  };

  const handleUpdateCommission = async (studentId: string, commission: string) => {
    const cid = selectedCourse.id || selectedCourse.course?.id;
    if (!cid) return;
    try {
      const studentRef = doc(db, "profiles", studentId);
      await updateDoc(studentRef, {
        [`commissions.${cid}`]: commission
      });
      // Update local state instantly
      setRoster((prev: any) => prev.map((s: any) => {
        if (s.id === studentId) {
          return {
            ...s,
            commissions: {
              ...(s.commissions || {}),
              [cid]: commission
            }
          };
        }
        return s;
      }));
    } catch (err: any) {
      showToast("Error al asignar comisión: " + err.message, "error");
    }
  };

  return (
    <>
              <div className="space-y-6">
                <div className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-white">Alumnos y Alertas de Desempeño</h3>
                      <p className="text-xs text-gray-400 mt-1">
                        Seguimiento en tiempo real del presentismo y cumplimiento de tareas de los estudiantes inscriptos.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <div className="flex items-center space-x-1.5 bg-neutral-950 px-3 py-1.5 rounded-xl border border-neutral-850">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-sans">Comisión:</span>
                        <select
                          value={commissionFilter}
                          onChange={(e) => setCommissionFilter(e.target.value)}
                          className="bg-transparent text-xs text-gray-300 focus:outline-none cursor-pointer font-semibold"
                        >
                          <option value="Todas">Todas</option>
                          {courseCommissions.map((comm: any) => (
                            <option key={comm} value={comm}>{comm}</option>
                          ))}
                          <option value="Sin Comisión">Sin Comisión</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={handleExportGradesMatrix}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-lg"
                      >
                        <span>📊 Exportar Planilla (Sheets)</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCheckAndAlertStudentsAtRisk}
                        className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-amber-500 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-lg"
                      >
                        <span>📢 Alertas Automáticas</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadPDFReport}
                        className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-blue-400 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-lg"
                      >
                        <span>📄 Descargar Reporte PDF</span>
                      </button>
                    </div>
                  </div>

                  {/* CSV ENDPOINT BLOCK FOR GOOGLE SHEETS =IMPORTDATA (NORMALLY COLLAPSED/HIDDEN) */}
                  <div className="bg-neutral-950/60 p-4 rounded-xl border border-neutral-850 space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowCsvEndpoint(!showCsvEndpoint)}
                      className="w-full flex justify-between items-center text-xs font-bold text-gray-300 hover:text-white transition cursor-pointer select-none"
                      aria-expanded={showCsvEndpoint}
                      aria-controls="csv-endpoint-collapse"
                    >
                      <span className="flex items-center space-x-2">
                        <span>📊 URL de Endpoint CSV para Planillas de Cálculo (Google Sheets / Excel)</span>
                      </span>
                      <span className="text-[10px] bg-neutral-900 px-2.5 py-1 rounded-lg border border-neutral-800 text-gray-400 font-semibold">
                        {showCsvEndpoint ? "▲ Ocultar URL" : "▼ Mostrar URL"}
                      </span>
                    </button>

                    {showCsvEndpoint && (
                      <div id="csv-endpoint-collapse" className="pt-3 space-y-2 border-t border-neutral-900 animate-in fade-in duration-200">
                        <p className="text-[10px] text-gray-400 leading-relaxed">
                          Conectá esta URL directamente en Google Sheets con <code className="text-emerald-400 font-mono font-bold">=IMPORTDATA(&quot;...&quot;)</code> para sincronizar automáticamente el roster y alertas de desempeño:
                        </p>
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            readOnly
                            value={`https://us-central1-jutsu-classroom-mrtin.cloudfunctions.net/exportGradesCsv?id=${selectedCourse.id || selectedCourse.course?.id}&type=roster&token=${selectedCourse.sync_secret || 'SECRET'}`}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-gray-300 select-all font-mono"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              const url = `https://us-central1-jutsu-classroom-mrtin.cloudfunctions.net/exportGradesCsv?id=${selectedCourse.id || selectedCourse.course?.id}&type=roster&token=${selectedCourse.sync_secret || 'SECRET'}`;
                              const ok = await copyToClipboard(url);
                              showToast(ok ? "¡URL del Endpoint CSV de Alumnos copiada al portapapeles con éxito!" : "No se pudo copiar la URL.", "success");
                            }}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap"
                          >
                            Copiar URL CSV
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="overflow-x-auto bg-neutral-950/40 border border-neutral-850 rounded-2xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-800 bg-neutral-950/60 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          <th className="p-4">Estudiante</th>
                          <th className="p-4">Matrícula</th>
                          <th className="p-4">Asistencia</th>
                          <th className="p-4">Tareas Entregadas</th>
                          <th className="p-4">Alertas Tempranas</th>
                          <th className="p-4">Condición</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-850 text-xs text-gray-300">
                        {roster
                          .filter((student: any) => {
                            if (student.role !== "student") return false;
                            const studentComm = student.commissions?.[selectedCourse.id || selectedCourse.course?.id] || "";
                            if (commissionFilter === "Todas") return true;
                            if (commissionFilter === "Sin Comisión") return studentComm === "";
                            return studentComm === commissionFilter;
                          })
                          .map((student: any) => {
                            const attStats = attendanceStats.get(student.id) || { recordedCount: 0, presentOrLate: 0 };
                            const recordedCount = attStats.recordedCount;
                            const presentOrLate = attStats.presentOrLate;
                            const attendanceRate = recordedCount > 0 ? (presentOrLate / recordedCount) * 100 : 100;
                            const hasCriticalAttendance = recordedCount >= 3 && attendanceRate < 75;

                            const studentSubsMap = submissionsByStudent.get(student.id) || new Map();
                            const submittedCount = studentSubsMap.size;
                            const totalAssignments = assignments.length;
                            const hasMissingAssignments = assignments.some((a: any) => {
                              const hasSub = studentSubsMap.has(a.id);
                              const isPastDue = pastDueAssignments.has(a.id);
                              return !hasSub && isPastDue;
                            });

                            const isAtRisk = hasCriticalAttendance || hasMissingAssignments;

                            return (
                              <tr key={student.id} className="hover:bg-neutral-900/30 transition-colors">
                                <td className="p-4">
                                  <div className="font-semibold text-white">{student.full_name || "Estudiante"}</div>
                                  <div className="text-[10px] text-gray-500 flex items-center space-x-2 mt-1">
                                    <span>{student.email}</span>
                                    {profile?.role === "teacher" ? (
                                      <select
                                        value={student.commissions?.[selectedCourse.id || selectedCourse.course?.id] || ""}
                                        onChange={(e) => handleUpdateCommission(student.id, e.target.value)}
                                        className="bg-neutral-950 border border-neutral-800 text-[9px] rounded px-1.5 py-0.5 text-gray-400 focus:outline-none focus:border-blue-500 cursor-pointer font-semibold font-sans"
                                      >
                                        <option value="">Sin Comisión</option>
                                        {courseCommissions.map((comm: any) => (
                                          <option key={comm} value={comm}>{comm}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      student.commissions?.[selectedCourse.id || selectedCourse.course?.id] && (
                                        <span className="bg-neutral-800 text-gray-400 border border-neutral-750 text-[9px] px-1.5 py-0.5 rounded font-semibold font-mono">
                                          {student.commissions[selectedCourse.id || selectedCourse.course?.id]}
                                        </span>
                                      )
                                    )}
                                  </div>
                                </td>
                              <td className="p-4 font-mono text-gray-400">{student.matricula_unrn || "No provista"}</td>
                              <td className="p-4 space-y-1">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span>{presentOrLate} / {recordedCount} clases</span>
                                  <span className={attendanceRate < 75 ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>
                                    {attendanceRate.toFixed(0)}%
                                  </span>
                                </div>
                                <div className="w-24 h-1.5 bg-neutral-900 border border-neutral-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${attendanceRate < 75 ? "bg-red-500" : "bg-emerald-500"}`}
                                    style={{ width: `${Math.min(100, attendanceRate)}%` }}
                                  ></div>
                                </div>
                              </td>
                              <td className="p-4 space-y-1">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span>{submittedCount} / {totalAssignments} tareas</span>
                                  <span className="text-gray-400 font-bold">
                                    {totalAssignments > 0 ? ((submittedCount / totalAssignments) * 100).toFixed(0) : 100}%
                                  </span>
                                </div>
                                <div className="w-24 h-1.5 bg-neutral-900 border border-neutral-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-blue-500"
                                    style={{ width: `${totalAssignments > 0 ? (submittedCount / totalAssignments) * 100 : 100}%` }}
                                  ></div>
                                </div>
                              </td>
                              <td className="p-4 min-w-[170px]">
                                <div className="flex flex-col gap-1.5">
                                  {hasCriticalAttendance && (
                                    <span className="px-3 py-1.5 rounded-xl bg-red-950/90 border border-red-700/60 text-red-300 text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 shadow-sm animate-pulse whitespace-nowrap">
                                      <span>⚠️</span>
                                      <span>Asistencia Crítica (&lt;75%)</span>
                                    </span>
                                  )}
                                  {hasMissingAssignments && (
                                    <span className="px-3 py-1.5 rounded-xl bg-amber-950/90 border border-amber-700/60 text-amber-300 text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 shadow-sm whitespace-nowrap">
                                      <span>⚠️</span>
                                      <span>Tareas Atrasadas</span>
                                    </span>
                                  )}
                                  {!hasCriticalAttendance && !hasMissingAssignments && (
                                    <span className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-gray-400 text-xs font-bold uppercase tracking-wider inline-block text-center whitespace-nowrap">
                                      Sin Alertas
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center space-x-2">
                                  <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                                    isAtRisk
                                      ? "bg-red-950/40 border border-red-900/30 text-red-400"
                                      : "bg-emerald-950/40 border border-emerald-900/30 text-emerald-400"
                                  }`}>
                                    {isAtRisk ? "EN RIESGO" : "REGULAR"}
                                  </span>
                                  {(profile?.role === "teacher" || profile?.role === "admin") && (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedDirectEmailStudent(student)}
                                      className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600 border border-blue-500/40 text-blue-300 hover:text-white rounded-lg text-[10px] font-bold transition flex items-center space-x-1 cursor-pointer whitespace-nowrap shadow-sm"
                                      title="Enviar correo directo a este estudiante"
                                    >
                                      <span>✉️ Email</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {roster.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-gray-500 italic">
                              No hay alumnos inscriptos en esta cátedra.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
    </>
  );
}
