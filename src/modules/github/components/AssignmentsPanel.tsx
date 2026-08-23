"use client";

import { useState } from "react";
import { query, collection, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/clientApp";
import GithubActivityPanel from "./GithubActivityPanel";

export default function AssignmentsPanel({
  selectedCourse,
  profile,
  courseCommissions,
  showToast,
  setApiLoading,
  api,
  assignments,
  setAssignments,
  submissions,
  setSubmissions,
  commissionFilter,
  setCommissionFilter,
  moodleLtiParams,
  moodleApiUrl,
  moodleWsToken,
  moodleCourseId
}: any) {
  // Assignments states
  const [assignTitle, setAssignTitle] = useState("");
  const [assignTemplate, setAssignTemplate] = useState("");
  const [assignPr, setAssignPr] = useState(false);
  const [assignGroup, setAssignGroup] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [gradesCSVStatus, setGradesCSVStatus] = useState<Record<string, string>>({});
  const [visibleCommitsSubId, setVisibleCommitsSubId] = useState<string | null>(null);

  // Grader & GitHub activity states
  const [graderSubmissions, setGraderSubmissions] = useState<Record<string, any[]>>({});
  const [expandedGraderAssignmentId, setExpandedGraderAssignmentId] = useState<string | null>(null);
  const [githubActivitySubmissionId, setGithubActivitySubmissionId] = useState<string | null>(null);
  const [githubActivityData, setGithubActivityData] = useState<{ commits: any[], pullRequests: any[], comments: any[] } | null>(null);
  const [githubActivityLoading, setGithubActivityLoading] = useState(false);
  const [plagiarismResults, setPlagiarismResults] = useState<Record<string, any>>({});
  const [plagiarismOpenId, setPlagiarismOpenId] = useState<string | null>(null);
  const [plagiarismLoading, setPlagiarismLoading] = useState(false);
  const [githubActivityTab, setGithubActivityTab] = useState<"commits" | "pulls" | "comments" | "visualizer">("commits");
  const [editingGrades, setEditingGrades] = useState<Record<string, string>>({});
  const [editingFeedbacks, setEditingFeedbacks] = useState<Record<string, string>>({});
  const [expandedAuditLogs, setExpandedAuditLogs] = useState<Record<string, any[]>>({});
  
  const [studentGithubActivity, setStudentGithubActivity] = useState<{ commits: any[], pullRequests: any[], comments: any[] } | null>(null);
  const [studentGithubActivityTab, setStudentGithubActivityTab] = useState<"commits" | "pulls" | "comments" | "visualizer">("commits");

  // Modals
  const [groupPromptModal, setGroupPromptModal] = useState<{ isOpen: boolean; assignmentId: string; resolve: (val: string | null) => void } | null>(null);
  const [commentPromptModal, setCommentPromptModal] = useState<{ isOpen: boolean; submissionId: string; resolve: (val: string | null) => void } | null>(null);

  // --- Handlers ---
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTitle || !assignTemplate) return showToast("Título y Repositorio Plantilla son obligatorios.", "success");
    const cid = typeof selectedCourse === "string" ? selectedCourse : (selectedCourse?.id || selectedCourse?.course_id || selectedCourse?.course?.id || "");
    if (!cid) return showToast("Debe seleccionar una materia para crear la tarea.", "success");
    setApiLoading(true);
    try {
      if (editingAssignmentId) {
        await api("updateAssignment", {
          assignmentId: editingAssignmentId,
          data: { title: assignTitle, template_repo: assignTemplate, create_feedback_pr: assignPr, is_group: assignGroup }
        });
        setEditingAssignmentId(null);
        showToast("Tarea modificada.", "success");
      } else {
        await api("createAssignment", {
          course_id: cid, courseId: cid, title: assignTitle, template_repo: assignTemplate, create_feedback_pr: assignPr, is_group: assignGroup
        });
        showToast("Tarea creada exitosamente.", "success");
      }
      setAssignTitle(""); setAssignTemplate(""); setAssignPr(false); setAssignGroup(false);

      const res = await api("getTeacherAssignments");
      setAssignments((res.data || []).filter((a: any) => a.course_id === cid));
    } catch (err: any) {
      showToast("Error al gestionar tarea: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  const handleArchiveAssignment = async (id: string) => {
    if (!confirm("¿Seguro que deseas archivar esta tarea? Los permisos en GitHub cambiarán a SOLO LECTURA.")) return;
    setApiLoading(true);
    try {
      const res = await api("archiveAssignment", { assignmentId: id });
      showToast(`¡Tarea archivada! Permisos modificados en ${res.data.count} repositorios.`, "success");
      const cid = selectedCourse.id || selectedCourse.course?.id;
      const r = await api("getTeacherAssignments");
      setAssignments((r.data || []).filter((a: any) => a.course_id === cid));
    } catch (err: any) {
      showToast("Error al archivar la tarea: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  const handleToggleGrader = async (assignmentId: string) => {
    if (expandedGraderAssignmentId === assignmentId) {
      setExpandedGraderAssignmentId(null);
      return;
    }
    setApiLoading(true);
    try {
      const res = await api("getAssignmentSubmissions", { assignmentId });
      setGraderSubmissions(prev => ({ ...prev, [assignmentId]: res || [] }));
      setExpandedGraderAssignmentId(assignmentId);
      
      const grades: Record<string, string> = {};
      const feedbacks: Record<string, string> = {};
      (res || []).forEach((s: any) => { grades[s.id] = s.grade || ""; feedbacks[s.id] = s.feedback || ""; });
      setEditingGrades(prev => ({ ...prev, ...grades }));
      setEditingFeedbacks(prev => ({ ...prev, ...feedbacks }));
    } catch (err: any) {
      showToast("Error al cargar entregas: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };
  const handleDetectPlagiarism = async (assignmentId: string) => {
    if (plagiarismOpenId === assignmentId) {
      setPlagiarismOpenId(null);
      return;
    }
    setPlagiarismLoading(true);
    try {
      const res = await api("detectAssignmentPlagiarism", { assignmentId });
      setPlagiarismResults(prev => ({ ...prev, [assignmentId]: res }));
      setPlagiarismOpenId(assignmentId);
      showToast(`Análisis completo: ${res.flaggedCount} pares sospechosos de ${res.analyzedCount} entregas.`, res.flaggedCount > 0 ? "error" : "success");
    } catch (err: any) {
      showToast("Error al detectar plagio: " + err.message, "error");
    } finally {
      setPlagiarismLoading(false);
    }
  };

  const handleFetchGithubActivity = async (submissionId: string) => {
    if (githubActivitySubmissionId === submissionId) {
      setGithubActivitySubmissionId(null); setGithubActivityData(null);
      return;
    }
    setGithubActivityLoading(true);
    setGithubActivitySubmissionId(submissionId);
    setGithubActivityTab("commits");
    try {
      const res = await api("getStudentGithubActivity", { submissionId });
      setGithubActivityData(res || { commits: [], pullRequests: [], comments: [] });
    } catch (err: any) {
      showToast("Error al cargar actividad: " + err.message, "error");
      setGithubActivitySubmissionId(null); setGithubActivityData(null);
    } finally {
      setGithubActivityLoading(false);
    }
  };

  const handleSaveSingleGrade = async (submissionId: string, assignmentId: string) => {
    const grade = editingGrades[submissionId];
    const feedback = editingFeedbacks[submissionId];
    setApiLoading(true);
    try {
      await api("gradeSubmission", { submissionId, grade, feedback });
      showToast("Calificación guardada.", "success");
      const res = await api("getAssignmentSubmissions", { assignmentId });
      setGraderSubmissions(prev => ({ ...prev, [assignmentId]: res || [] }));
    } catch (err: any) {
      showToast("Error al guardar: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  const handleToggleAuditLogs = async (submissionId: string) => {
    if (expandedAuditLogs[submissionId]) {
      setExpandedAuditLogs(prev => { const next = { ...prev }; delete next[submissionId]; return next; });
      return;
    }
    try {
      const q = query(collection(db, "audit_logs"), where("submission_id", "==", submissionId), orderBy("created_at", "desc"));
      const snap = await getDocs(q);
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setExpandedAuditLogs(prev => ({ ...prev, [submissionId]: logs }));
    } catch (err: any) {
      showToast("Error cargar auditoría: " + err.message, "error");
    }
  };

  const handleDownloadGradesTemplate = async (assignmentId: string, title: string) => {
    const cid = selectedCourse.id || selectedCourse.course?.id;
    setApiLoading(true);
    try {
      const res = await api("getCourseRoster", { courseId: cid });
      if (!res || res.length === 0) return showToast("No hay alumnos.", "success");
      let csv = "Matricula,Email,Usuario_Github,Nota,Feedback\n";
      res.forEach((p: any) => { csv += `"${p.matricula_unrn || ""}","${p.email || ""}","${p.github_user || ""}","",""\n`; });
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `plantilla_notas_${title.replace(/\s+/g, "_")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      showToast("Error plantilla: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  const handleImportCSVGrades = async (assignmentId: string, token: string, files: FileList | null) => {
    if (!files || !files.length) return;
    setGradesCSVStatus({ ...gradesCSVStatus, [assignmentId]: "⏳ Subiendo notas..." });
    try {
      const res = await fetch(`https://us-central1-jutsu-classroom-mrtin.cloudfunctions.net/importGrades?assignmentId=${assignmentId}&token=${token}`, {
        method: "POST", headers: { "Content-Type": "text/csv" }, body: await files[0].text()
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setGradesCSVStatus({ ...gradesCSVStatus, [assignmentId]: `✅ Éxito: ${data.updatedCount || 0} notas cargadas.` });
    } catch (err: any) {
      setGradesCSVStatus({ ...gradesCSVStatus, [assignmentId]: "❌ Error: " + err.message });
    }
  };

  const handleExportGradesToMoodle = async (assignmentId: string) => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) return;
    if (!moodleApiUrl || !moodleWsToken || !moodleCourseId) return showToast("Configurá Moodle primero.", "success");
    setApiLoading(true);
    try {
      const res = await api("exportGradesToMoodleWebservice", { courseId: cid, moodleUrl: moodleApiUrl, moodleToken: moodleWsToken, moodleCourseId: moodleCourseId, assignmentId });
      showToast(`¡Notas enviadas! ${res.pushedCount} en Moodle.`, "success");
    } catch (err: any) {
      showToast("Error Moodle: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  const handleAcceptAssignment = async (assignmentId: string, isGroup: boolean) => {
    let groupName = "";
    if (isGroup) {
      const name = await new Promise<string | null>((resolve) => { setGroupPromptModal({ isOpen: true, assignmentId, resolve }); });
      if (!name) return;
      groupName = name;
    }
    setApiLoading(true);
    try {
      await api("acceptAssignment", { assignmentId, groupName, moodle_lis_outcome_service_url: moodleLtiParams?.current?.outcomeUrl || "", moodle_lis_result_sourcedid: moodleLtiParams?.current?.resultId || "" });
      showToast("¡Repositorio creado!", "success");
      const cid = selectedCourse.id || selectedCourse.course?.id;
      const aRes = await api("getStudentAssignments", { courseIds: [cid] });
      setAssignments(aRes.assignments || []); setSubmissions(aRes.submissions || []);
    } catch (err: any) {
      showToast("Error: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  const handleMarkAsSubmitted = async (submissionId: string) => {
    const msg = await new Promise<string | null>((resolve) => { setCommentPromptModal({ isOpen: true, submissionId, resolve }); });
    if (msg === null) return;
    setApiLoading(true);
    try {
      await api("submitAssignment", { submissionId, message: msg });
      showToast("¡Entrega enviada!", "success");
      const cid = selectedCourse.id || selectedCourse.course?.id;
      const aRes = await api("getStudentAssignments", { courseIds: [cid] });
      setAssignments(aRes.assignments || []); setSubmissions(aRes.submissions || []);
    } catch (err: any) {
      showToast("Error: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  const handleViewCommits = async (submissionId: string) => {
    if (visibleCommitsSubId === submissionId) { setVisibleCommitsSubId(null); setStudentGithubActivity(null); return; }
    setApiLoading(true); setStudentGithubActivityTab("commits");
    try {
      const res = await api("getStudentGithubActivity", { submissionId });
      setStudentGithubActivity(res || { commits: [], pullRequests: [], comments: [] });
      setVisibleCommitsSubId(submissionId);
    } catch (err: any) {
      showToast("Error: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {profile?.role === "teacher" ? (
        <div className="space-y-6">
          <form onSubmit={handleCreateAssignment} className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4">
            <h4 className="font-bold text-sm text-gray-400 uppercase tracking-wider">{editingAssignmentId ? "✏️ Editar Tarea" : "➕ Crear Nueva Tarea"}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Título de la Tarea</label>
                <input type="text" value={assignTitle} onChange={(e) => setAssignTitle(e.target.value)} placeholder="Ej: Trabajo Práctico 1" className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Repositorio Plantilla (org/repo)</label>
                <input type="text" value={assignTemplate} onChange={(e) => setAssignTemplate(e.target.value)} placeholder="Ej: unrn-prog2-2026/tp1-plantilla" className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white" required />
              </div>
            </div>
            <div className="flex space-x-6 items-center">
              <label className="flex items-center space-x-2 text-xs font-semibold text-gray-400 cursor-pointer">
                <input type="checkbox" checked={assignPr} onChange={(e) => setAssignPr(e.target.checked)} className="rounded bg-neutral-950 border-neutral-800 text-blue-600 focus:ring-0" />
                <span>Crear Pull Request de Feedback</span>
              </label>
              <label className="flex items-center space-x-2 text-xs font-semibold text-gray-400 cursor-pointer">
                <input type="checkbox" checked={assignGroup} onChange={(e) => setAssignGroup(e.target.checked)} className="rounded bg-neutral-950 border-neutral-800 text-blue-600 focus:ring-0" />
                <span>Tarea Grupal</span>
              </label>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition">{editingAssignmentId ? "Guardar Cambios" : "Crear Tarea"}</button>
              {editingAssignmentId && <button type="button" onClick={() => { setEditingAssignmentId(null); setAssignTitle(""); setAssignTemplate(""); setAssignPr(false); setAssignGroup(false); }} className="px-5 py-2.5 bg-neutral-950 border border-neutral-800 text-gray-400 rounded-xl text-xs font-semibold transition">Cancelar</button>}
            </div>
          </form>

          <div className="space-y-4">
            {assignments.map((a: any) => (
              <div key={a.id} className="p-6 bg-neutral-900/40 border border-neutral-800 rounded-2xl space-y-4">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <h5 className="font-bold text-base text-white">{a.title}{a.is_group && <span className="ml-2.5 px-2 py-0.5 rounded bg-blue-950 border border-blue-800/40 text-blue-400 text-[10px] font-bold uppercase tracking-wider">Grupal</span>}</h5>
                    <p className="text-xs text-gray-500 mt-1">Plantilla: {a.template_repo}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => handleExportGradesToMoodle(a.id)} className="px-3 py-1.5 bg-purple-950/50 hover:bg-purple-900/50 border border-purple-800/60 rounded-lg text-[11px] font-semibold text-purple-300 transition flex items-center space-x-1 cursor-pointer" title="Enviar calificaciones corregidas de esta tarea a Moodle Gradebook"><span>📤 Moodle</span></button>
                    <button onClick={() => { setEditingAssignmentId(a.id); setAssignTitle(a.title); setAssignTemplate(a.template_repo); setAssignPr(a.create_feedback_pr || false); setAssignGroup(a.is_group || false); }} className="px-3 py-1.5 bg-amber-950/50 hover:bg-amber-900/50 border border-amber-800/60 rounded-lg text-[11px] font-semibold text-amber-300 transition">Editar</button>
                    <button onClick={() => handleArchiveAssignment(a.id)} className="px-3 py-1.5 bg-red-950/50 hover:bg-red-900/50 border border-red-800/60 rounded-lg text-[11px] font-semibold text-red-300 transition">Archivar (Solo Lectura)</button>
                  </div>
                </div>

                <div className="border-t border-neutral-800/60 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                    <button onClick={() => handleDownloadGradesTemplate(a.id, a.title)} className="px-3 py-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold text-gray-300 transition">📥 Descargar Plantilla Notas</button>
                    <button
                      type="button"
                      onClick={() => window.open("/templates/ninja-dojo-autograde.yml", "_blank")}
                      className="px-3 py-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold text-gray-300 transition"
                      title="Descarga la plantilla de GitHub Actions para autocalificar esta tarea: el alumno la agrega a su repo, corre los tests y publica la nota vía webhook"
                    >🤖 Plantilla Autograding</button>
                    <div className="relative">
                      <input type="file" accept=".csv" id={`csv-file-${a.id}`} onChange={(e) => handleImportCSVGrades(a.id, selectedCourse.sync_secret || "TOKEN", e.target.files)} className="hidden" />
                      <label htmlFor={`csv-file-${a.id}`} className="px-3 py-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold text-gray-300 transition inline-block text-center cursor-pointer">📤 Cargar Notas CSV</label>
                    </div>
                    <button type="button" onClick={() => handleToggleGrader(a.id)} className="px-3 py-2 bg-blue-955/50 hover:bg-blue-900/50 border border-blue-800 rounded-xl text-xs font-semibold text-blue-300 transition cursor-pointer">{expandedGraderAssignmentId === a.id ? "📂 Ocultar Entregas" : "📂 Ver Entregas y Actividad"}</button>
                    <button
                      type="button"
                      onClick={() => handleDetectPlagiarism(a.id)}
                      disabled={plagiarismLoading}
                      className="px-3 py-2 bg-red-950/40 hover:bg-red-900/40 border border-red-800/60 rounded-xl text-xs font-semibold text-red-300 transition cursor-pointer disabled:opacity-50"
                      title="Compara el código de las entregas entre alumnos y marca pares sospechosos de copia"
                    >{plagiarismLoading ? "🔎 Analizando…" : "🕵️ Detectar Plagio"}</button>
                    {plagiarismOpenId === a.id && plagiarismResults[a.id] && (
                      <div className="md:col-span-2 bg-neutral-950/60 border border-neutral-850 rounded-xl p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                            Análisis de similitud — {plagiarismResults[a.id].analyzedCount} entregas analizadas
                          </h5>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${plagiarismResults[a.id].flaggedCount > 0 ? "bg-red-500/20 text-red-300" : "bg-green-500/20 text-green-300"}`}>
                            {plagiarismResults[a.id].flaggedCount} par(es) sospechosos (umbral {plagiarismResults[a.id].threshold}%)
                          </span>
                        </div>
                        <div className="space-y-1.5 max-h-64 overflow-y-auto">
                          {plagiarismResults[a.id].pairs.map((pair: any, idx: number) => (
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
                          {plagiarismResults[a.id].pairs.length === 0 && (
                            <p className="text-[11px] text-gray-500 italic">No hay pares comparables (se necesitan al menos dos entregas con repositorio).</p>
                          )}
                          {plagiarismResults[a.id].skipped?.length > 0 && (
                            <details className="pt-1">
                              <summary className="text-[10px] text-gray-500 cursor-pointer">Entregas omitidas ({plagiarismResults[a.id].skipped.length})</summary>
                              <ul className="mt-1 space-y-0.5">
                                {plagiarismResults[a.id].skipped.map((sk: any, i: number) => (
                                  <li key={i} className="text-[10px] text-gray-600">• {sk.student}: {sk.reason}</li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {gradesCSVStatus[a.id] && <p className="text-xs font-semibold">{gradesCSVStatus[a.id]}</p>}
                </div>

                {expandedGraderAssignmentId === a.id && (
                  <div className="border-t border-neutral-800/60 pt-6 mt-6 space-y-6">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <h6 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Entregas de los Estudiantes</h6>
                      <div className="flex items-center space-x-1.5 bg-neutral-950 px-2.5 py-1 rounded-lg border border-neutral-850">
                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-sans">Comisión:</span>
                        <select value={commissionFilter} onChange={(e) => setCommissionFilter(e.target.value)} className="bg-transparent text-[10px] text-gray-300 focus:outline-none cursor-pointer font-semibold font-sans">
                          <option value="Todas">Todas</option>
                          {courseCommissions.map((comm: string) => <option key={comm} value={comm}>{comm}</option>)}
                          <option value="Sin Comisión">Sin Comisión</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      {(graderSubmissions[a.id] || []).filter((sub: any) => {
                        const studentComm = sub.profiles?.commissions?.[selectedCourse.id || selectedCourse.course?.id] || "";
                        if (commissionFilter === "Todas") return true;
                        if (commissionFilter === "Sin Comisión") return studentComm === "";
                        return studentComm === commissionFilter;
                      }).map((sub: any) => {
                        const studentName = sub.profiles?.full_name || sub.profiles?.email || "Estudiante";
                        const isGitHubLoaded = githubActivitySubmissionId === sub.id;
                        return (
                          <div key={sub.id} className="bg-neutral-950/60 border border-neutral-850 p-5 rounded-2xl space-y-4 text-left">
                            <div className="flex justify-between items-start flex-wrap gap-2">
                              <div>
                                <h6 className="font-bold text-sm text-white">{studentName}</h6>
                                <p className="text-[10px] text-gray-500 font-mono">Matrícula: {sub.profiles?.matricula_unrn || "-"}</p>
                                {sub.repo_url && <a href={sub.repo_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline mt-1 inline-block">GitHub: {sub.repo_url.replace("https://github.com/", "")} ↗</a>}
                              </div>
                              <div className="flex bg-neutral-900 p-0.5 rounded-lg border border-neutral-800 text-[10px] font-bold">
                                <span className={`px-2.5 py-1 rounded ${sub.status === "submitted" ? "bg-blue-950 text-blue-400" : "bg-neutral-800 text-gray-400"}`}>{sub.status === "submitted" ? "Entregado" : "Borrador"}</span>
                              </div>
                            </div>
                            <div>
                              <button type="button" onClick={() => handleFetchGithubActivity(sub.id)} className="text-xs text-emerald-400 hover:text-emerald-300 underline font-semibold focus:outline-none flex items-center gap-1.5 cursor-pointer">
                                🔍 {isGitHubLoaded ? "Ocultar Actividad GitHub" : "Ver Actividad GitHub (Commits, PRs, Comentarios)"}
                              </button>
                            </div>
                            {isGitHubLoaded && (
                              <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-4 mt-2 space-y-4 font-sans text-xs">
                                <GithubActivityPanel activity={githubActivityData || { commits: [], pullRequests: [], comments: [] }} activeTab={githubActivityTab} setActiveTab={setGithubActivityTab} isLoading={githubActivityLoading} />
                              </div>
                            )}
                            <div className="border-t border-neutral-900/60 pt-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                              <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Nota</label>
                                <input type="text" value={editingGrades[sub.id] || ""} onChange={(e) => setEditingGrades(prev => ({ ...prev, [sub.id]: e.target.value }))} placeholder="Nota (Ej: 9, Aprobado)" className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-white" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Feedback / Comentario</label>
                                <input type="text" value={editingFeedbacks[sub.id] || ""} onChange={(e) => setEditingFeedbacks(prev => ({ ...prev, [sub.id]: e.target.value }))} placeholder="Buen trabajo..." className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-white" />
                              </div>
                              <button type="button" onClick={() => handleSaveSingleGrade(sub.id, a.id)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 rounded-xl transition cursor-pointer">Guardar Calificación</button>
                            </div>
                            <div className="pt-3">
                              <button type="button" onClick={() => handleToggleAuditLogs(sub.id)} className="text-gray-500 hover:text-gray-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer">
                                📜 {expandedAuditLogs[sub.id] ? "Ocultar Bitácora de Auditoría" : "Ver Bitácora de Auditoría"}
                              </button>
                              {expandedAuditLogs[sub.id] && (
                                <div className="mt-2 bg-neutral-950/80 border border-neutral-850 rounded-xl p-3 space-y-2">
                                  <h6 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Historial de Calificaciones (Inmutable)</h6>
                                  <div className="space-y-2.5 max-h-40 overflow-y-auto pr-1">
                                    {expandedAuditLogs[sub.id].map((log: any) => (
                                      <div key={log.id} className="text-[10.5px] border-b border-neutral-900 pb-2 last:border-b-0 space-y-1">
                                        <div className="flex justify-between text-gray-500">
                                          <span>Modificado por: <strong className="text-gray-300">{log.actor_name}</strong></span>
                                          <span>{log.created_at?.toDate ? log.created_at.toDate().toLocaleString("es-AR") : "Ahora"}</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs pt-1">
                                          <div>
                                            <span className="text-[9px] text-gray-500 block uppercase font-bold">Cambio de Nota</span>
                                            <span className="text-gray-400 font-mono">{log.previous_grade || "(sin nota)"} ➔ <strong className="text-amber-400">{log.new_grade}</strong></span>
                                          </div>
                                          <div>
                                            <span className="text-[9px] text-gray-500 block uppercase font-bold">Cambio de Feedback</span>
                                            <p className="text-gray-400 italic">&quot;{log.previous_feedback || "(sin feedback)"}&quot; ➔ <strong className="text-gray-300">&quot;{log.new_feedback}&quot;</strong></p>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                    {expandedAuditLogs[sub.id].length === 0 && <p className="text-[10px] text-gray-500 italic">No hay registros.</p>}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {(!graderSubmissions[a.id] || graderSubmissions[a.id].filter((sub: any) => { const studentComm = sub.profiles?.commissions?.[selectedCourse.id || selectedCourse.course?.id] || ""; if (commissionFilter === "Todas") return true; if (commissionFilter === "Sin Comisión") return studentComm === ""; return studentComm === commissionFilter; }).length === 0) && (
                        <p className="text-xs text-gray-500 italic text-center py-4 bg-neutral-950/20 rounded-xl border border-neutral-850 border-dashed">No hay entregas registradas en esta comisión aún.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {assignments.length === 0 && <p className="text-gray-550 text-sm">No hay tareas pendientes en este curso.</p>}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((a: any) => {
            const sub = submissions.find((s: any) => s.assignment_id === a.id);
            return (
              <div key={a.id} className={`p-6 rounded-2xl border ${sub ? "bg-green-950/10 border-green-900/40" : "bg-neutral-900/30 border-neutral-800"} space-y-4`}>
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <h5 className="font-bold text-base text-white">{sub ? "✅ " : "⏳ "} {a.title}{a.is_group && <span className="ml-2.5 px-2 py-0.5 rounded bg-blue-950 border border-blue-800/40 text-blue-400 text-[10px] font-bold uppercase tracking-wider">Grupal</span>}</h5>
                  {sub && <span className="text-xs bg-neutral-950 border border-neutral-850 px-3 py-1 rounded-lg"><strong>Nota:</strong> {sub.grade || <span className="text-gray-500">Sin calificar</span>}</span>}
                </div>
                {sub ? (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <a href={sub.repo_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-green-400 hover:underline">Ver mi repositorio en GitHub ↗</a>
                      {sub.feedback && <p className="text-xs text-gray-300"><strong>Feedback:</strong> {sub.feedback}</p>}
                    </div>
                    <div className="border-t border-neutral-850 pt-4 flex gap-2">
                      <button onClick={() => handleViewCommits(sub.id)} className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition">🔍 Ver Commits</button>
                      {sub.status !== "submitted" ? (
                        <button onClick={() => handleMarkAsSubmitted(sub.id)} className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition">🚀 Marcar como Entregado</button>
                      ) : (
                        <span className="text-xs text-blue-400 font-bold px-3 py-1.5 bg-blue-950/40 border border-blue-900/40 rounded-xl">Entregado para Corrección</span>
                      )}
                    </div>
                    {visibleCommitsSubId === sub.id && (
                      <div className="bg-neutral-950/80 border border-neutral-850 p-4 rounded-xl space-y-4 text-xs mt-3">
                        <GithubActivityPanel activity={studentGithubActivity || { commits: [], pullRequests: [], comments: [] }} activeTab={studentGithubActivityTab} setActiveTab={setStudentGithubActivityTab} isLoading={!studentGithubActivity} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-gray-400 mb-3 leading-relaxed">Aún no has aceptado esta tarea. Al hacer click abajo se creará tu repositorio.</p>
                    <button onClick={() => handleAcceptAssignment(a.id, a.is_group || false)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition">Aceptar Tarea en GitHub</button>
                  </div>
                )}
              </div>
            );
          })}
          {assignments.length === 0 && <p className="text-gray-550 text-sm">No hay tareas pendientes en este curso.</p>}
        </div>
      )}

      {/* Modals */}
      {groupPromptModal?.isOpen && (() => {
        let inputVal = "";
        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl max-w-sm w-full min-w-[280px] sm:min-w-[380px] shrink-0 mx-auto space-y-4 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold text-white font-sans">Nombre del Equipo</h3>
              <p className="text-xs text-gray-400 font-sans">Esta es una tarea grupal. Ingresá el nombre de tu equipo:</p>
              <input type="text" placeholder="Nombre del grupo" className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-sans" onChange={(e) => { inputVal = e.target.value; }} onKeyDown={(e) => { if (e.key === "Enter" && inputVal.trim()) { groupPromptModal.resolve(inputVal.trim()); setGroupPromptModal(null); } }} />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { groupPromptModal.resolve(null); setGroupPromptModal(null); }} className="flex-1 px-4 py-2 bg-neutral-850 hover:bg-neutral-800 border border-neutral-800 text-xs font-bold text-gray-300 rounded-xl transition cursor-pointer font-sans">Cancelar</button>
                <button type="button" onClick={() => { if (inputVal.trim()) { groupPromptModal.resolve(inputVal.trim()); setGroupPromptModal(null); } else { showToast("Ingresa un nombre.", "success"); } }} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer font-sans">Confirmar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {commentPromptModal?.isOpen && (() => {
        let inputVal = "";
        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl max-w-sm w-full min-w-[280px] sm:min-w-[380px] shrink-0 mx-auto space-y-4 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold text-white font-sans">Comentarios de la Entrega</h3>
              <p className="text-xs text-gray-400 font-sans">¿Querés dejarle algún comentario al profesor sobre esta entrega? (Opcional):</p>
              <textarea placeholder="Escribe tu mensaje aquí..." className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 min-h-20 font-sans" onChange={(e) => { inputVal = e.target.value; }} />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { commentPromptModal.resolve(null); setCommentPromptModal(null); }} className="flex-1 px-4 py-2 bg-neutral-850 hover:bg-neutral-800 border border-neutral-800 text-xs font-bold text-gray-300 rounded-xl transition cursor-pointer font-sans">Cancelar</button>
                <button type="button" onClick={() => { commentPromptModal.resolve(inputVal.trim()); setCommentPromptModal(null); }} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer font-sans">Enviar Entrega</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
