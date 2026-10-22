"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase/clientApp";

/**
 * Segundo paso del launch LTI 1.3: canjea el código de un solo uso por un
 * custom token de Firebase e inicia la sesión, sin pedir otro login.
 */
export default function LtiContinuePage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = use(searchParams);
  const router = useRouter();
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await fetch("/api/v1/lti/handoff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: code || "" }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "No se pudo iniciar la sesión.");
        await signInWithCustomToken(auth, body.customToken);
        router.replace(body.redirect || "/dashboard");
      } catch (err: any) {
        setError(err.message || "No se pudo iniciar la sesión.");
      }
    })();
  }, [code, router]);

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
      {error ? (
        <div className="max-w-md text-center space-y-2" role="alert">
          <h1 className="text-lg font-bold">No pudimos completar el ingreso desde Moodle</h1>
          <p className="text-sm text-gray-400">{error}</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-gray-400" role="status">
          <span className="w-4 h-4 border-2 border-t-transparent border-red-500 rounded-full animate-spin" aria-hidden="true" />
          <span>Ingresando al Dojo…</span>
        </div>
      )}
    </main>
  );
}
