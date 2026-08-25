"use client";
import { useMemo } from "react";

interface StudentNinjaRankCardProps {
  profile: any;
  submissions: any[];
  courseComments: any[];
  courseAttendance: any[];
  onOpenProfile: () => void;
}

export function StudentNinjaRankCard({
  profile, submissions, courseComments, courseAttendance, onOpenProfile
}: StudentNinjaRankCardProps) {
  const {
    currentLevel,
    currentLevelProgress,
    totalXp,
    hasChakraMaster,
    hasPerfectAttendance,
    hasActiveNinja,
    hasSolucionador
  } = useMemo(() => {
    if (!profile?.id) {
      return {
        currentLevel: 1, currentLevelProgress: 0, totalXp: 0,
        hasChakraMaster: false, hasPerfectAttendance: false,
        hasActiveNinja: false, hasSolucionador: false
      };
    }

    const pId = profile.id;
    let commentPoints = 0;
    let solutionCount = 0;
    let activeNinjaCount = 0;

    // O(N) loop for comments
    for (let i = 0; i < courseComments.length; i++) {
      if (courseComments[i].user_id === pId) {
        activeNinjaCount++;
        commentPoints += 10;
        if (courseComments[i].is_best_answer) solutionCount++;
      }
    }
    const solutionPoints = solutionCount * 100;

    // O(N) loop for attendance
    let totalClasses = 0;
    let presentCount = 0;
    for (let i = 0; i < courseAttendance.length; i++) {
      const records = courseAttendance[i].records;
      if (records && records[pId]) {
        totalClasses++;
        if (records[pId] === "present" || records[pId] === "late") {
          presentCount++;
        }
      }
    }
    const attendancePoints = presentCount * 10;

    // O(N) loop for submissions
    let submissionPoints = 0;
    let gradesSum = 0;
    let gradesCount = 0;
    for (let i = 0; i < submissions.length; i++) {
      if (submissions[i].student_id === pId) {
        submissionPoints += 50;
        const num = parseFloat(submissions[i].grade);
        if (!isNaN(num)) {
          submissionPoints += num * 5;
          gradesSum += num;
          gradesCount++;
        }
      }
    }

    const _totalXp = commentPoints + solutionPoints + attendancePoints + submissionPoints;
    const avgGrade = gradesCount > 0 ? gradesSum / gradesCount : 0;

    return {
      currentLevel: Math.floor(_totalXp / 100) + 1,
      currentLevelProgress: _totalXp % 100,
      totalXp: _totalXp,
      hasChakraMaster: avgGrade >= 9,
      hasPerfectAttendance: totalClasses >= 3 && presentCount === totalClasses,
      hasActiveNinja: activeNinjaCount >= 3,
      hasSolucionador: solutionCount > 0
    };
  }, [profile?.id, submissions, courseComments, courseAttendance]);

  return (
    <div
      onClick={onOpenProfile}
      className="bg-gradient-to-r from-blue-955/20 via-neutral-900/60 to-purple-955/20 border border-neutral-800 hover:border-blue-500/50 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-lg animate-fade-in cursor-pointer transition group"
      title="Haz clic para ver tu bitácora de puntos de experiencia (XP) en Mi Perfil"
    >
      <div className="space-y-2.5 flex-1">
        <div className="flex items-center space-x-2.5">
          <span className="text-2xl animate-bounce">🥷</span>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest font-sans">Rango Ninja de Cursada</h4>
              <span className="text-[10px] text-blue-400 group-hover:underline font-semibold">📜 Ver bitácora XP ↗</span>
            </div>
            <div className="text-lg font-black text-blue-400">
              Nivel {currentLevel} — {currentLevel >= 5 ? "Jōnin" : currentLevel >= 3 ? "Chūnin" : "Genin"}
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-bold text-gray-400 font-mono">
            <span>Progreso de Nivel ({totalXp} XP Totales)</span>
            <span>{currentLevelProgress} / 100 XP</span>
          </div>
          <div className="w-full h-2 bg-neutral-950 border border-neutral-850 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${currentLevelProgress}%` }}></div>
          </div>
        </div>
      </div>

      <div className="space-y-1.5 min-w-[200px]">
        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-sans">Medallas de Honor</h4>
        <div className="flex flex-wrap gap-2">
          {hasChakraMaster && (
            <span className="px-2.5 py-1 rounded-xl bg-amber-955/60 border border-amber-800/40 text-amber-400 text-[10px] font-bold flex items-center space-x-1.5" title="Promedio de notas superior a 9">
              <span>🥇 Maestro de Chakra</span>
            </span>
          )}
          {hasPerfectAttendance && (
            <span className="px-2.5 py-1 rounded-xl bg-emerald-955/60 border border-emerald-800/40 text-emerald-400 text-[10px] font-bold flex items-center space-x-1.5" title="Asistencia perfecta a todas las clases registradas">
              <span>🥈 Asistencia Perfecta</span>
            </span>
          )}
          {hasActiveNinja && (
            <span className="px-2.5 py-1 rounded-xl bg-blue-955/60 border border-blue-800/40 text-blue-400 text-[10px] font-bold flex items-center space-x-1.5" title="Participación activa en foros de clases">
              <span>🥉 Ninja Activo</span>
            </span>
          )}
          {hasSolucionador && (
            <span className="px-2.5 py-1 rounded-xl bg-purple-955/60 border border-purple-800/40 text-purple-400 text-[10px] font-bold flex items-center space-x-1.5" title="Respuestas marcadas como solución por el docente">
              <span>🎖️ Solucionador</span>
            </span>
          )}
          {!hasChakraMaster && !hasPerfectAttendance && !hasActiveNinja && !hasSolucionador && (
            <span className="text-xs text-gray-500 italic">Participa y entrega tareas para ganar medallas.</span>
          )}
        </div>
      </div>
    </div>
  );
}
