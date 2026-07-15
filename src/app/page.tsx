"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/clientApp";
import Link from "next/link";

export default function Home() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push("/dashboard");
      } else {
        setCheckingAuth(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-t-blue-500 border-blue-900 rounded-full animate-spin"></div>
          <p className="text-gray-400 font-medium">Iniciando aplicación...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col justify-between relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 right-0 h-96 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.12)_0%,transparent_70%)] pointer-events-none"></div>

      {/* Navigation Header */}
      <header className="max-w-7xl w-full mx-auto px-6 py-6 flex justify-between items-center relative z-10">
        <div className="flex items-center space-x-2">
          <span className="text-xl font-bold bg-gradient-to-r from-red-400 to-amber-500 bg-clip-text text-transparent">
            Ninja Dojo
          </span>
        </div>
        <div>
          <Link
            href="/login"
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-blue-500/10 cursor-pointer"
          >
            Iniciar Sesión
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl w-full mx-auto px-6 text-center py-20 relative z-10 flex-1 flex flex-col justify-center">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent leading-tight md:leading-normal">
          El portal definitivo para la gestión académica
        </h1>
        <p className="mt-6 text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
          Una plataforma unificada construida sobre Next.js y Firebase para centralizar tus clases, tareas, repositorios y control de asistencia física.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4">
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition shadow-xl shadow-blue-500/20 text-center cursor-pointer"
          >
            Comenzar Nueva Versión
          </Link>
          <a
            href="/index.html"
            className="w-full sm:w-auto px-8 py-3.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-gray-300 rounded-xl text-sm font-semibold transition text-center"
          >
            Ingresar a la Versión Anterior (Legacy)
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-8 border-t border-neutral-900 text-xs text-gray-600 relative z-10">
        <p>© 2026 Ninja Dojo. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
