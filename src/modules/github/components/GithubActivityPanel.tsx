import React from "react";
import CommitVisualizer from "./CommitVisualizer";
import { computeGithubMetrics } from "../utils/metrics";

interface CommitItem {
  sha: string;
  message: string;
  date: string;
  author: string;
  author_login: string;
  author_avatar: string;
  branch: string;
  url?: string;
}

interface PullRequestItem {
  number: number;
  title: string;
  state: "open" | "closed";
  url?: string;
}

interface CommentItem {
  author: string;
  created_at: string;
  body: string;
}

interface GithubActivity {
  commits: CommitItem[];
  pullRequests: PullRequestItem[];
  comments: CommentItem[];
}

type ActivityTab = "commits" | "pulls" | "comments" | "metrics" | "visualizer";

interface GithubActivityPanelProps {
  activity: GithubActivity;
  activeTab: ActivityTab;
  setActiveTab: (tab: ActivityTab) => void;
  isLoading?: boolean;
}

export default function GithubActivityPanel({
  activity,
  activeTab,
  setActiveTab,
  isLoading = false,
}: GithubActivityPanelProps) {
  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 text-gray-500 animate-pulse py-2">
        <span className="w-3.5 h-3.5 border-2 border-t-transparent border-emerald-400 rounded-full animate-spin"></span>
        <span>Cargando actividad...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex border-b border-neutral-900 pb-2 gap-4">
        <button
          type="button"
          onClick={() => setActiveTab("commits")}
          className={`font-semibold pb-1 border-b-2 transition-colors cursor-pointer ${
            activeTab === "commits"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          Commits ({activity.commits.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("pulls")}
          className={`font-semibold pb-1 border-b-2 transition-colors cursor-pointer ${
            activeTab === "pulls"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          Pull Requests ({activity.pullRequests.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("comments")}
          className={`font-semibold pb-1 border-b-2 transition-colors cursor-pointer ${
            activeTab === "comments"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          Comentarios ({activity.comments.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("metrics")}
          className={`font-semibold pb-1 border-b-2 transition-colors cursor-pointer ${
            activeTab === "metrics"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          📈 Métricas
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("visualizer")}
          className={`font-semibold pb-1 border-b-2 transition-colors cursor-pointer ${
            activeTab === "visualizer"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          🌳 Gráfico Git & Aporte
        </button>
      </div>

      {/* Commits Tab */}
      {activeTab === "commits" && (
        <div className="space-y-2 max-h-40 overflow-y-auto pr-1 font-mono text-[10px] text-left">
          {activity.commits.map((c, idx) => (
            <div key={idx} className="flex justify-between border-b border-neutral-900/60 pb-1.5 last:border-0 last:pb-0">
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                {c.sha.substring(0, 7)}: <span className="text-gray-300 font-sans">{c.message}</span>
              </a>
              <span className="text-gray-500">{new Date(c.date).toLocaleDateString("es-AR")}</span>
            </div>
          ))}
          {activity.commits.length === 0 && <p className="text-gray-500 italic font-sans">No hay commits en el repositorio.</p>}
        </div>
      )}

      {/* Pull Requests Tab */}
      {activeTab === "pulls" && (
        <div className="space-y-2 max-h-40 overflow-y-auto pr-1 text-left">
          {activity.pullRequests.map((p, idx) => (
            <div key={idx} className="flex justify-between items-center border-b border-neutral-900/60 pb-1.5 last:border-0 last:pb-0">
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-xs">
                #{p.number}: <span className="text-gray-300 font-semibold">{p.title}</span>
              </a>
              <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                p.state === "open" ? "bg-green-950 text-green-400" : "bg-purple-950 text-purple-400"
              }`}>
                {p.state === "open" ? "Abierto" : "Cerrado"}
              </span>
            </div>
          ))}
          {activity.pullRequests.length === 0 && <p className="text-gray-500 italic">No hay pull requests abiertos o cerrados.</p>}
        </div>
      )}

      {/* Comments Tab */}
      {activeTab === "comments" && (
        <div className="space-y-2 max-h-40 overflow-y-auto pr-1 text-left">
          {activity.comments.map((c, idx) => (
            <div key={idx} className="bg-neutral-900/40 p-2.5 rounded-lg border border-neutral-900 space-y-1">
              <div className="flex justify-between items-center text-[10px] text-gray-500">
                <span className="font-bold text-gray-400">@{c.author}</span>
                <span>{new Date(c.created_at).toLocaleString("es-AR")}</span>
              </div>
              <p className="text-xs text-gray-300 whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
          {activity.comments.length === 0 && <p className="text-gray-500 italic">No hay comentarios en el código o pull requests.</p>}
        </div>
      )}

      {/* Metrics Tab */}
      {activeTab === "metrics" && <MetricsBoard commits={activity.commits} pulls={activity.pullRequests} />}

      {/* Visualizer Tab */}
      {activeTab === "visualizer" && <CommitVisualizer commits={activity.commits} />}
    </div>
  );
}

function MetricsBoard({ commits, pulls }: { commits: any[]; pulls: any[] }) {
  const m = computeGithubMetrics(commits, pulls);
  const maxWeek = Math.max(1, ...m.weekly.map((w) => w.count));
  const maxHour = Math.max(1, ...m.hours);

  return (
    <div className="space-y-4 text-left">
      {/* Summary chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Commits", value: m.totalCommits },
          { label: "Promedio / semana activa", value: m.avgPerActiveWeek },
          { label: "Hora pico", value: m.peakHour !== null ? `${m.peakHour}:00` : "—" },
          { label: "Commits nocturnos", value: `${m.nightOwlRatio}%` },
        ].map((chip) => (
          <div key={chip.label} className="bg-neutral-900/40 border border-neutral-900 rounded-xl px-3 py-2">
            <p className="text-[9px] uppercase tracking-wider text-gray-500 font-bold">{chip.label}</p>
            <p className="text-sm font-black text-emerald-400 font-mono">{chip.value}</p>
          </div>
        ))}
      </div>

      {/* Weekly frequency */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Frecuencia semanal (últimas 6 semanas)</p>
        <div className="flex items-end space-x-1.5 h-20">
          {m.weekly.map((w) => (
            <div key={w.label} className="flex-1 flex flex-col items-center justify-end space-y-1">
              <span className="text-[9px] text-gray-400 font-mono">{w.count || ""}</span>
              <div
                className="w-full bg-gradient-to-t from-emerald-700 to-emerald-400 rounded-t"
                style={{ height: `${Math.max(3, (w.count / maxWeek) * 100)}%`, minHeight: w.count ? undefined : "3px", opacity: w.count ? 1 : 0.25 }}
                title={`${w.count} commits`}
              ></div>
              <span className="text-[8px] text-gray-600 font-mono">{w.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hour distribution */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Horarios de trabajo (hora local)</p>
        <div className="flex items-end space-x-[2px] h-14">
          {m.hours.map((count, hour) => (
            <div key={hour} className="flex-1 flex flex-col items-center justify-end">
              <div
                className={`w-full rounded-t ${hour >= 20 || hour < 6 ? "bg-indigo-500/80" : "bg-blue-500/80"}`}
                style={{ height: `${Math.max(3, (count / maxHour) * 100)}%`, opacity: count ? 1 : 0.15 }}
                title={`${hour}:00 — ${count} commits`}
              ></div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[8px] text-gray-600 font-mono mt-0.5">
          <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
        </div>
      </div>

      {/* PR breakdown */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Pull Requests</p>
        <div className="flex flex-wrap gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-green-950/60 border border-green-800/40 text-green-400 text-[10px] font-bold">Abiertos: {m.prBreakdown.open}</span>
          <span className="px-2.5 py-1 rounded-lg bg-purple-950/60 border border-purple-800/40 text-purple-400 text-[10px] font-bold">Cerrados: {m.prBreakdown.closed}</span>
          <span className="px-2.5 py-1 rounded-lg bg-blue-950/60 border border-blue-800/40 text-blue-400 text-[10px] font-bold">Mergeados: {m.prBreakdown.merged}</span>
        </div>
      </div>
    </div>
  );
}
