"use client";

import { useState, useEffect } from "react";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  GithubAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  onAuthStateChanged
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/clientApp";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Por favor completa todos los campos.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
        router.push("/dashboard");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        router.push("/dashboard");
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setError("El correo ya está en uso.");
      } else if (err.code === "auth/wrong-password" || err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        setError("Credenciales incorrectas.");
      } else if (err.code === "auth/weak-password") {
        setError("La contraseña debe tener al menos 6 caracteres.");
      } else {
        setError(err.message || "Ocurrió un error al autenticar.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleProviderLogin = async (providerName: "google" | "github") => {
    setLoading(true);
    setError("");
    const provider = providerName === "google" ? new GoogleAuthProvider() : new GithubAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push("/dashboard");
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "";
      if (err.code === "auth/account-exists-with-different-credential") {
        setError("Ya existe una cuenta vinculada a este correo con otro proveedor.");
      } else if (msg.includes("missing initial state") || msg.includes("sessionStorage") || err.code === "auth/web-storage-unsupported") {
        setError("Error de Privacidad/Cookies: El navegador bloqueó el acceso a sessionStorage. Habilitá las cookies de terceros o probá en una pestaña normal.");
      } else {
        setError(msg || "Error al iniciar sesión.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-t-blue-500 border-blue-900 rounded-full animate-spin"></div>
          <p className="text-gray-400 font-medium animate-pulse">Cargando Ninja Dojo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] text-white flex flex-col justify-between relative overflow-x-hidden">
      {/* Background Radial Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.15)_0%,transparent_70%)] pointer-events-none"></div>

      {/* HEADER */}
      <header className="max-w-7xl w-full mx-auto px-6 py-6 flex justify-between items-center relative z-10 border-b border-neutral-900">
        <div className="flex items-center space-x-3">
          <span className="text-2xl font-black bg-gradient-to-r from-red-500 via-amber-400 to-blue-500 bg-clip-text text-transparent tracking-tight">
            🥷 Ninja Dojo
          </span>
          <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-950/60 text-blue-400 border border-blue-800/40">
            Jutsu Classroom v2.0
          </span>
        </div>
        <div className="text-xs text-neutral-400 font-medium">
          Entorno Académico Integrado
        </div>
      </header>

      {/* MAIN CONTAINER: LANDING + LOGIN */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 relative z-10 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: PITCH & SECTIONS (8 cols) */}
          <div className="lg:col-span-7 space-y-8 text-left">
            <div>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent leading-tight">
                La plataforma de gestión académica para Estudiantes y Docentes
              </h1>
              <p className="text-neutral-400 text-sm sm:text-base mt-3 leading-relaxed">
                Centralizá tus clases, entregas, grupos de estudio, tutorías y seguimiento de notas en un solo lugar.
              </p>
            </div>

            {/* SECCIÓN 1: ESTUDIANTES */}
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-5 sm:p-6 space-y-4 hover:border-neutral-700 transition shadow-xl">
              <div className="flex items-center space-x-2">
                <span className="px-3 py-1 bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 rounded-full text-xs font-bold uppercase tracking-wider">
                  🎓 Estudiantes
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-5 rounded-2xl overflow-hidden border border-neutral-800 shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src="/images/student_green_eyes.jpg" 
                    alt="Estudiante con ojos brillantes verdes sosteniendo tarjeta de informe"
                    className="w-full h-48 md:h-56 object-cover hover:scale-105 transition duration-500"
                  />
                </div>
                <div className="md:col-span-7 space-y-3">
                  <p className="text-neutral-200 font-semibold text-sm sm:text-base leading-snug">
                    &ldquo;Haz un seguimiento de tu progreso, únete a clases y trabaja en grupos sin sentirte como un lobo solitario.&rdquo;
                  </p>
                  
                  {/* MEME ESTUDIANTES */}
                  <div className="bg-neutral-950 p-3.5 rounded-2xl border border-neutral-800 text-xs space-y-2">
                    <div className="flex items-center space-x-2 text-amber-400 font-mono font-bold text-[11px] uppercase tracking-wider">
                      <span>🐱 MEME MODE ON:</span>
                    </div>
                    <p className="text-neutral-300 font-mono text-[11px] leading-relaxed">
                      🐾 <strong>YO ESCRIBIENDO UN ENSAYO A LAS 3 AM</strong> <span className="text-amber-500">VS.</span> 🐾 <strong>YO RASTREANDO MIS CALIFICACIONES EN NINJA DOJO.</strong>
                    </p>
                    <div className="flex items-center space-x-2 text-[10px] text-neutral-500 italic">
                      <span>(Escribiendo furiosamente a 200 WPM en el teclado) ⚡</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: PROFESORES */}
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-5 sm:p-6 space-y-4 hover:border-neutral-700 transition shadow-xl">
              <div className="flex items-center space-x-2">
                <span className="px-3 py-1 bg-purple-950/80 text-purple-400 border border-purple-800/50 rounded-full text-xs font-bold uppercase tracking-wider">
                  👨‍🏫 Profesores & Docentes
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-5 rounded-2xl overflow-hidden border border-neutral-800 shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src="/images/sensei_smartboard.jpg" 
                    alt="Sensei sabio señalando con pincel a la pizarra inteligente"
                    className="w-full h-48 md:h-56 object-cover hover:scale-105 transition duration-500"
                  />
                </div>
                <div className="md:col-span-7 space-y-3">
                  <p className="text-neutral-200 font-semibold text-sm sm:text-base leading-snug">
                    &ldquo;Asigna tareas, da feedback y comunícate. Todo en un solo lugar. No más palomas mensajeras.&rdquo;
                  </p>

                  {/* MEME PROFESORES CONTRASTE */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-red-955/30 border border-red-900/50 p-2.5 rounded-xl text-red-300">
                      <p className="text-[10px] font-bold uppercase text-red-400 mb-1">🔥 &apos;This is Fine&apos; Dog</p>
                      <p className="text-[11px]">&ldquo;ENSEÑANDO SIN UNA BUENA PLATAFORMA.&rdquo;</p>
                    </div>
                    <div className="bg-emerald-955/30 border border-emerald-900/50 p-2.5 rounded-xl text-emerald-300">
                      <p className="text-[10px] font-bold uppercase text-emerald-400 mb-1">😺 &apos;Actually Fine&apos; Cat</p>
                      <p className="text-[11px]">&ldquo;ENSEÑANDO CON NINJA DOJO.&rdquo;</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: LOGIN FORM (5 cols) */}
          <div className="lg:col-span-5 w-full lg:sticky lg:top-8">
            <div className="w-full bg-neutral-900/90 backdrop-blur-2xl border border-neutral-800 p-6 sm:p-8 rounded-3xl shadow-2xl relative z-10 text-left">
              <div className="text-center mb-6">
                <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  {isRegistering ? "Creá tu Cuenta Académica" : "Ingresar a Ninja Dojo"}
                </h2>
                <p className="text-neutral-400 text-xs mt-1.5">
                  {isRegistering ? "Unite a tu cátedra en 1 clic" : "Accedé a tus clases y entregas"}
                </p>
              </div>

              {error && (
                <div className="mb-5 p-3.5 bg-red-950/60 border border-red-800/80 rounded-xl text-red-400 text-xs break-words">
                  {error}
                </div>
              )}

              <form onSubmit={handleEmailAuth} className="space-y-4 w-full">
                <div>
                  <label htmlFor="email" className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alumno@unrn.edu.ar"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-blue-500 transition text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                    Contraseña
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-blue-500 transition text-white font-mono"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 transition text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center space-x-2 text-xs sm:text-sm disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
                  ) : (
                    <span>{isRegistering ? "Registrarse e Ingresar" : "Iniciar Sesión"}</span>
                  )}
                </button>
              </form>

              <div className="relative my-6 w-full">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-800"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                  <span className="bg-neutral-900 px-3 text-neutral-500">O ingresar con</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full">
                <button
                  onClick={() => handleProviderLogin("google")}
                  disabled={loading}
                  className="flex items-center justify-center space-x-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-xl py-2.5 transition text-xs font-medium text-white cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Google</span>
                </button>

                <button
                  onClick={() => handleProviderLogin("github")}
                  disabled={loading}
                  className="flex items-center justify-center space-x-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-xl py-2.5 transition text-xs font-medium text-white cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.479C19.138 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                  </svg>
                  <span>GitHub</span>
                </button>
              </div>

              <div className="mt-6 text-center text-xs text-neutral-400">
                {isRegistering ? (
                  <p>
                    ¿Ya tenés una cuenta?{" "}
                    <button
                      onClick={() => setIsRegistering(false)}
                      className="text-blue-400 hover:underline font-bold bg-transparent border-none p-0 cursor-pointer"
                    >
                      Iniciá sesión
                    </button>
                  </p>
                ) : (
                  <p>
                    ¿No tenés una cuenta?{" "}
                    <button
                      onClick={() => setIsRegistering(true)}
                      className="text-blue-400 hover:underline font-bold bg-transparent border-none p-0 cursor-pointer"
                    >
                      Registrate gratis
                    </button>
                  </p>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* FOOTER */}
      <footer className="w-full text-center py-6 border-t border-neutral-900 text-xs text-neutral-600 relative z-10">
        <p>© 2026 Ninja Dojo (Jutsu Classroom). Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
