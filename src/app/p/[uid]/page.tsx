import { notFound } from "next/navigation";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

/**
 * Public project portfolio: /p/{uid}. Server-rendered with the Admin SDK so
 * no Firestore rules need to open reads to anonymous visitors. Only
 * submissions explicitly flagged `is_public` by their owner are listed.
 */

async function loadPortfolio(uid: string) {
  if (!getApps().length) initializeApp();
  const db = getFirestore();

  const profileSnap = await db.collection("profiles").doc(uid).get();
  if (!profileSnap.exists) return null;

  const subsSnap = await db
    .collection("submissions")
    .where("student_id", "==", uid)
    .where("is_public", "==", true)
    .get();

  const items = [];
  for (const doc of subsSnap.docs) {
    const sub = doc.data();
    let title: string | null = null;
    let courseName: string | null = null;
    if (sub.assignment_id) {
      const aSnap = await db.collection("assignments").doc(sub.assignment_id).get();
      const aData = aSnap.data();
      if (aSnap.exists && aData) {
        title = aData.title || null;
        const cid = aData.course_id;
        if (cid) {
          const cSnap = await db.collection("courses").doc(cid).get();
          courseName = cSnap.exists ? cSnap.data()?.name ?? null : null;
        }
      }
    }
    if (sub.repo_url) {
      items.push({ id: doc.id, title, courseName, repoUrl: sub.repo_url, grade: sub.grade ?? null });
    }
  }

  return { profile: profileSnap.data() ?? {}, items };
}

export default async function PortfolioPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  const data = await loadPortfolio(uid);
  if (!data) notFound();

  const { profile, items } = data;
  const initials = (profile.full_name || "U").substring(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-neutral-800 bg-gradient-to-r from-red-950/30 via-neutral-900 to-amber-950/20">
        <div className="max-w-4xl mx-auto px-6 py-10 flex items-center space-x-5">
          <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center font-black text-xl overflow-hidden shrink-0">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-500 font-bold mb-1">Portafolio de Proyectos · Ninja Dojo</p>
            <h1 className="text-2xl font-bold">{profile.full_name || "Estudiante"}</h1>
            {profile.cohorte && <p className="text-xs text-gray-400 mt-0.5">Cohorte {profile.cohorte}</p>}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {items.length === 0 ? (
          <div className="border border-dashed border-neutral-800 rounded-2xl p-12 text-center text-gray-500">
            Todavía no hay proyectos públicos en este portafolio.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.map((item) => (
              <a
                key={item.id}
                href={item.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-neutral-900/60 border border-neutral-800 hover:border-emerald-600/50 rounded-2xl p-5 transition"
              >
                <div className="flex justify-between items-start gap-3">
                  <h2 className="font-bold text-gray-100 group-hover:text-emerald-400 transition">
                    {item.title || "Proyecto"}
                  </h2>
                  {item.grade && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 text-[10px] font-bold shrink-0">
                      {item.grade}
                    </span>
                  )}
                </div>
                {item.courseName && (
                  <p className="text-[11px] text-gray-500 mt-1">{item.courseName}</p>
                )}
                <p className="text-[10px] text-blue-400 font-mono mt-3 truncate">{item.repoUrl.replace(/^https?:\/\//, "")}</p>
              </a>
            ))}
          </div>
        )}

        <footer className="mt-12 pt-6 border-t border-neutral-900 text-center text-[10px] text-gray-600">
          Los proyectos son publicados voluntariamente por su autor.
        </footer>
      </main>
    </div>
  );
}
