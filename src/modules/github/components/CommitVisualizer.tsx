import React from "react";

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

interface CommitVisualizerProps {
  commits: CommitItem[];
}

export default function CommitVisualizer({ commits }: CommitVisualizerProps) {
  const totalCommits = commits.length;
  const stats: Record<string, { name: string; count: number; avatar: string }> = {};

  commits.forEach((c) => {
    const key = c.author_login || "desconocido";
    if (!stats[key]) {
      stats[key] = {
        name: c.author || "Desconocido",
        count: 0,
        avatar: c.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.author || "U")}`,
      };
    }
    stats[key].count++;
  });

  return (
    <div className="space-y-4 text-left">
      {/* Work Distribution Card */}
      <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-850 space-y-3">
        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
          Distribución del Trabajo (Commits)
        </span>
        <div className="space-y-2">
          {Object.entries(stats).map(([login, authorData]) => {
            const percentage = totalCommits > 0 ? Math.round((authorData.count / totalCommits) * 100) : 0;
            return (
              <div key={login} className="space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <div className="flex items-center space-x-2">
                    <img src={authorData.avatar} alt={authorData.name} className="w-4.5 h-4.5 rounded-full object-cover" />
                    <span className="text-white font-medium">{authorData.name} (@{login})</span>
                  </div>
                  <span className="text-gray-400 font-bold">
                    {authorData.count} commits ({percentage}%)
                  </span>
                </div>
                <div className="w-full bg-neutral-950 h-2 rounded-full overflow-hidden border border-neutral-900">
                  <div
                    className="bg-gradient-to-r from-red-500 to-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Branch & Commits Timeline Card */}
      <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-850 space-y-3">
        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
          Flujo de Ramas y Commits
        </span>
        <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
          {commits.map((c, index) => {
            const branchColorMap: Record<string, { dot: string; bg: string; text: string }> = {
              main: { dot: "bg-emerald-500", bg: "bg-emerald-950/20", text: "text-emerald-400 border-emerald-800/40" },
              dev: { dot: "bg-blue-500", bg: "bg-blue-950/20", text: "text-blue-400 border-blue-800/40" },
              "feature/alerts": { dot: "bg-amber-500", bg: "bg-amber-950/20", text: "text-amber-400 border-amber-800/40" },
            };
            const color = branchColorMap[c.branch] || branchColorMap["main"];

            return (
              <div key={index} className="flex items-start space-x-3 text-[10px]">
                <div className="flex flex-col items-center pt-1 w-12 relative">
                  <div className="flex space-x-2.5">
                    <div className="w-2.5 h-2.5 flex items-center justify-center">
                      {c.branch === "main" ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/30 relative z-10"></span>
                      ) : (
                        <span className="w-0.5 h-5 bg-neutral-800 absolute top-0"></span>
                      )}
                    </div>
                    <div className="w-2.5 h-2.5 flex items-center justify-center">
                      {c.branch === "dev" ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-md shadow-blue-500/30 relative z-10"></span>
                      ) : (
                        <span className="w-0.5 h-5 bg-neutral-800 absolute top-0"></span>
                      )}
                    </div>
                    <div className="w-2.5 h-2.5 flex items-center justify-center">
                      {c.branch === "feature/alerts" ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-md shadow-amber-500/30 relative z-10"></span>
                      ) : (
                        <span className="w-0.5 h-5 bg-neutral-800 absolute top-0"></span>
                      )}
                    </div>
                  </div>
                  {index < commits.length - 1 && (
                    <div className="w-0.5 h-7 bg-neutral-800 mt-1 absolute top-2.5"></div>
                  )}
                </div>

                <div className="flex-1 bg-neutral-950/45 p-2 rounded-lg border border-neutral-900 space-y-1">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-1.5">
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline font-mono"
                      >
                        {c.sha.substring(0, 7)}
                      </a>
                      <span className={`px-1.5 py-0.2 rounded border text-[8px] font-bold uppercase ${color.bg} ${color.text}`}>
                        {c.branch}
                      </span>
                    </div>
                    <span className="text-gray-500">{new Date(c.date).toLocaleString("es-AR")}</span>
                  </div>
                  <p className="text-gray-350 font-sans">{c.message}</p>
                  <div className="flex items-center space-x-1 pt-1 text-[9px] text-gray-500 font-sans">
                    <span>Autor:</span>
                    <img src={c.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.author || "U")}`} alt={c.author} className="w-3.5 h-3.5 rounded-full object-cover" />
                    <span className="text-gray-400">
                      {c.author} (@{c.author_login})
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
