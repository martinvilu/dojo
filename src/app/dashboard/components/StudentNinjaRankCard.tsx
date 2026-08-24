"use client";
import React, { useMemo } from 'react';

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
  // ⚡ Bolt Optimization: Memoize all expensive array filtering operations
  // Avoids O(N) recalculations on every render for large arrays
  const {
    currentLevel,
    currentLevelProgress,
    totalXp,
    hasChakraMaster,
    hasPerfectAttendance,
    hasActiveNinja,
    hasSolucionador
  } = useMemo(() => {
    const profId = profile?.id;
    if (!profId) {
      return {
        currentLevel: 1, currentLevelProgress: 0, totalXp: 0,
        hasChakraMaster: false, hasPerfectAttendance: false, hasActiveNinja: false, hasSolucionador: false
      };
    }

    const studentComments = courseComments.filter(c => c.user_id === profId);
    let bestAnswersCount = 0;
    studentComments.forEach(c => {
      if (c.is_best_answer) bestAnswersCount++;
    });

    const commentPoints = studentComments.length * 10;
    const solutionPoints = bestAnswersCount * 100;

    let presentCount = 0;
    const studentAtts = courseAttendance.filter(c => c.records && c.records[profId]);
    studentAtts.forEach(c => {
      const rec = c.records[profId];
      if (rec === "present" || rec === "late") {
        presentCount++;
      }
    });
    const attendancePoints = presentCount * 10;

    const studentSubmissions = submissions.filter(s => s.student_id === profId);
    let submissionPoints = studentSubmissions.length * 50;
    let gradesSum = 0;
    let gradesCount = 0;

    studentSubmissions.forEach(s => {
      const num = parseFloat(s.grade);
      if (!isNaN(num)) {
        submissionPoints += num * 5;
        gradesSum += num;
        gradesCount++;
      }
    });

    const totalXpCalc = commentPoints + solutionPoints + attendancePoints + submissionPoints;
    const avgGrade = gradesCount > 0 ? gradesSum / gradesCount : 0;
    const totalClasses = studentAtts.length;

    return {
      totalXp: totalXpCalc,
      currentLevel: Math.floor(totalXpCalc / 100) + 1,
      currentLevelProgress: totalXpCalc % 100,
      hasChakraMaster: avgGrade >= 9,
      hasPerfectAttendance: totalClasses >= 3 && presentCount === totalClasses,
      hasActiveNinja: studentComments.length >= 3,
      hasSolucionador: bestAnswersCount > 0
    };
  }, [courseComments, courseAttendance, submissions, profile?.id]);

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
