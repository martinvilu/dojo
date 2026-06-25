"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, db, functions } from "@/lib/firebase/clientApp";
import { httpsCallable } from "firebase/functions";

// Callable API helper
const apiCall = httpsCallable(functions, "api");
const api = async (action: string, payload: any = {}) => {
  const res = await apiCall({ action, payload });
  return res.data as any;
};

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "teacher" | "student";
  avatar_url?: string;
  account_status: "pending" | "approved";
  matricula_unrn?: string;
  cohorte?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiLoading, setApiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("");
  const [error, setError] = useState("");

  // Pending Matricula inputs
  const [matriculaInput, setMatriculaInput] = useState("");
  const [matriculaError, setMatriculaError] = useState("");

  // Profile Edit state
  const [profileMatricula, setProfileMatricula] = useState("");
  const [profileCohorte, setProfileCohorte] = useState("");

  // Data states
  const [courses, setCourses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [globalSettings, setGlobalSettings] = useState<any>({});
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);

  // Form states
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseOrg, setNewCourseOrg] = useState("");
  const [enrollCode, setEnrollCode] = useState("");
  const [globalCalendarUrl, setGlobalCalendarUrl] = useState("");

  // Fetch profiles and manage auth status
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setCurrentUser(user);
      try {
        let profileRes = await api("getProfile");
        if (!profileRes) {
          // Wait briefly for cloud function trigger on first login
          await new Promise((r) => setTimeout(r, 2000));
          profileRes = await api("getProfile");
        }
        
        const userProfile = profileRes as UserProfile;
        setProfile(userProfile);

        // Set default active tab based on role
        if (userProfile.account_status === "approved") {
          if (userProfile.role === "admin") {
            setActiveTab("admin-courses");
          } else if (userProfile.role === "teacher") {
            setActiveTab("teacher-courses");
          } else {
            setActiveTab("student-courses");
          }
        }
      } catch (err: any) {
        console.error("Error loading profile:", err);
        setError("Error al cargar perfil de usuario: " + err.message);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Load data when tab changes
  useEffect(() => {
    if (!profile || profile.account_status !== "approved") return;

    const loadData = async () => {
      setApiLoading(true);
      try {
        if (activeTab === "admin-courses") {
          const res = await api("getAdminCourses");
          setCourses(res || []);
        } else if (activeTab === "admin-users") {
          const res = await api("getAdminUsers");
          setUsers(res || []);
        } else if (activeTab === "admin-settings") {
          const res = await api("getGlobalSettings");
          setGlobalSettings(res || {});
          setGlobalCalendarUrl(res?.globalCalendarIcsUrl || "");
        } else if (activeTab === "teacher-courses") {
          const res = await api("getTeacherCourses");
          setCourses(res || []);
        } else if (activeTab === "student-courses") {
          const res = await api("getStudentCourses");
          setCourses(res || []);
        } else if (activeTab === "profile" && profile) {
          setProfileMatricula(profile.matricula_unrn || "");
          setProfileCohorte(profile.cohorte || "");
        }
      } catch (err: any) {
        console.error("Error loading tab data:", err);
        setError("Error de red: " + err.message);
      } finally {
        setApiLoading(false);
      }
    };

    loadData();
    setSelectedCourse(null);
  }, [activeTab, profile]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  // Submit matricula validation (for pending students)
  const handleSubmitMatricula = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^UNRN-\d{5,}$/.test(matriculaInput)) {
      setMatriculaError("Formato inválido. Debe ser UNRN- seguido de al menos 5 números.");
      return;
    }
    setMatriculaError("");
    setApiLoading(true);
    try {
      await api("submitMatricula", { matricula: matriculaInput });
      // Reload profile
      const profileRes = await api("getProfile");
      setProfile(profileRes);
      if (profileRes?.role === "student") {
        setActiveTab("student-courses");
      }
    } catch (err: any) {
      setError("Error al enviar la matrícula: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  // Admin: Approve user manually
  const handleApproveUser = async (uid: string) => {
    if (!confirm("¿Aprobar manualmente a este usuario?")) return;
    setApiLoading(true);
    try {
      await api("approveUser", { targetUid: uid });
      const res = await api("getAdminUsers");
      setUsers(res || []);
    } catch (err: any) {
      setError("Error al aprobar usuario: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  // Admin: Create course
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName) return;
    setApiLoading(true);
    try {
      await api("createCourse", { name: newCourseName, github_org: newCourseOrg });
      setNewCourseName("");
      setNewCourseOrg("");
      const res = await api("getAdminCourses");
      setCourses(res || []);
    } catch (err: any) {
      setError("Error al crear curso: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  // Admin: Save global settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiLoading(true);
    try {
      await api("saveGlobalSettings", { globalCalendarIcsUrl: globalCalendarUrl });
      alert("Configuración guardada.");
    } catch (err: any) {
      setError("Error al guardar configuraciones: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  // Student: Join course by code
  const handleEnrollCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollCode) return;
    setApiLoading(true);
    try {
      await api("enrollCourse", { code: enrollCode.toUpperCase().trim() });
      setEnrollCode("");
      const res = await api("getStudentCourses");
      setCourses(res || []);
      alert("¡Te has enrolado con éxito!");
    } catch (err: any) {
      alert("Error al enrolarse: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  // Profile: Update personal profile
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiLoading(true);
    try {
      await api("updateProfile", { matricula_unrn: profileMatricula, cohorte: profileCohorte });
      const profileRes = await api("getProfile");
      setProfile(profileRes);
      alert("Perfil actualizado correctamente.");
    } catch (err: any) {
      setError("Error al actualizar perfil: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  // View course details (shared logic)
  const viewCourseDetails = async (courseId: string) => {
    setApiLoading(true);
    try {
      if (profile?.role === "admin") {
        const res = await api("getAdminCourseDetails", { courseId });
        setSelectedCourse(res);
      } else {
        const res = await api("getCourseDetails", { courseId });
        setSelectedCourse(res);
      }
    } catch (err: any) {
      alert("Error al cargar detalles de la cátedra: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-t-blue-500 border-blue-900 rounded-full animate-spin"></div>
          <p className="text-gray-400 font-medium">Cargando plataforma...</p>
        </div>
      </div>
    );
  }

  // PENDING APPROVAL VIEW
  if (profile && profile.account_status === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white px-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.05)_0%,transparent_70%)] pointer-events-none"></div>
        <div className="w-full max-w-lg bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 p-8 rounded-2xl shadow-2xl relative z-10 text-center">
          <h2 className="text-2xl font-bold text-amber-500 mb-4">Registro en Proceso de Aprobación</h2>
          <p className="text-gray-300 text-sm mb-6">
            Para acceder como estudiante, es requisito validar tu número de matrícula de la UNRN (formato <strong>UNRN-######</strong>).
          </p>
          
          <form onSubmit={handleSubmitMatricula} className="space-y-4 max-w-md mx-auto">
            <input
              type="text"
              value={matriculaInput}
              onChange={(e) => setMatriculaInput(e.target.value)}
              placeholder="Ej: UNRN-12345"
              className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-center font-mono text-white"
              required
            />
            {matriculaError && (
              <p className="text-red-400 text-xs text-left">{matriculaError}</p>
            )}
            <button
              type="submit"
              disabled={apiLoading}
              className="w-full bg-amber-600 hover:bg-amber-500 active:bg-amber-700 transition text-white font-medium py-3 rounded-xl shadow-lg shadow-amber-500/20 text-sm disabled:opacity-55"
            >
              {apiLoading ? "Enviando..." : "Validar Matrícula"}
            </button>
          </form>

          <div className="my-6 border-t border-neutral-800"></div>

          <p className="text-gray-400 text-xs mb-6">
            ¿No sos estudiante o no tenés matrícula?<br />
            Tu cuenta quedará en espera de aprobación manual por parte de un docente o administrador.
          </p>

          <button
            onClick={handleLogout}
            className="px-6 py-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-sm transition"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col md:flex-row">
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-neutral-900 border-b md:border-b-0 md:border-r border-neutral-800 flex flex-col p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
            Gaula Classroom
          </h1>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">
            {profile?.role === "admin" ? "Administrador" : profile?.role === "teacher" ? "Profesor" : "Estudiante"}
          </p>
        </div>

        {/* User Badge */}
        <div className="flex items-center space-x-3 bg-neutral-950/50 p-3 rounded-xl border border-neutral-800">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white uppercase overflow-hidden text-sm">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
            ) : (
              profile?.full_name?.substring(0, 2) || "U"
            )}
          </div>
          <div className="overflow-hidden">
            <h4 className="text-sm font-semibold truncate">{profile?.full_name}</h4>
            <p className="text-xs text-gray-500 truncate">{currentUser?.email}</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          {profile?.role === "admin" && (
            <>
              <button
                onClick={() => setActiveTab("admin-courses")}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer flex items-center space-x-3 ${
                  activeTab === "admin-courses" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-neutral-800 hover:text-white"
                }`}
              >
                <span>Cátedras</span>
              </button>
              <button
                onClick={() => setActiveTab("admin-users")}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer flex items-center space-x-3 ${
                  activeTab === "admin-users" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-neutral-800 hover:text-white"
                }`}
              >
                <span>Usuarios</span>
              </button>
              <button
                onClick={() => setActiveTab("admin-settings")}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer flex items-center space-x-3 ${
                  activeTab === "admin-settings" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-neutral-800 hover:text-white"
                }`}
              >
                <span>Configuración</span>
              </button>
            </>
          )}

          {profile?.role === "teacher" && (
            <>
              <button
                onClick={() => setActiveTab("teacher-courses")}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer flex items-center space-x-3 ${
                  activeTab === "teacher-courses" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-neutral-800 hover:text-white"
                }`}
              >
                <span>Mis Cátedras</span>
              </button>
            </>
          )}

          {profile?.role === "student" && (
            <>
              <button
                onClick={() => setActiveTab("student-courses")}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer flex items-center space-x-3 ${
                  activeTab === "student-courses" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-neutral-800 hover:text-white"
                }`}
              >
                <span>Mis Cátedras</span>
              </button>
            </>
          )}

          <button
            onClick={() => setActiveTab("profile")}
            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer flex items-center space-x-3 ${
              activeTab === "profile" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-neutral-800 hover:text-white"
            }`}
          >
            <span>Mi Perfil</span>
          </button>
        </nav>

        <div className="border-t border-neutral-800 pt-4 space-y-2">
          {/* Link to legacy fallback */}
          <a
            href="/index.html"
            className="w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold bg-neutral-950 border border-neutral-800 text-gray-400 hover:text-white transition flex items-center justify-center space-x-2"
          >
            <span>Versión Anterior (Legacy)</span>
          </a>
          <button
            onClick={handleLogout}
            className="w-full text-center px-4 py-2.5 rounded-xl text-xs font-semibold bg-red-950/30 text-red-400 hover:bg-red-900/40 hover:text-red-300 transition cursor-pointer"
          >
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-8 overflow-y-auto max-w-6xl">
        {error && (
          <div className="mb-6 p-4 bg-red-950/40 border border-red-800/80 rounded-xl text-red-400 text-sm flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError("")} className="text-xs text-gray-400 hover:text-white underline">
              Cerrar
            </button>
          </div>
        )}

        {apiLoading && (
          <div className="mb-6 p-3 bg-neutral-900 border border-neutral-800 rounded-xl text-blue-400 text-sm flex items-center space-x-3">
            <span className="w-4 h-4 border-2 border-t-transparent border-blue-500 rounded-full animate-spin"></span>
            <span>Cargando datos remotos...</span>
          </div>
        )}

        {/* TABS CONTROLLERS */}

        {/* 1. ADMIN COURSES */}
        {activeTab === "admin-courses" && !selectedCourse && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Gestión de Cátedras</h2>
            </div>

            {/* Create course form */}
            <form onSubmit={handleCreateCourse} className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nombre de la Cátedra</label>
                <input
                  type="text"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  placeholder="Ej: Programación II"
                  className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Organización GitHub</label>
                <input
                  type="text"
                  value={newCourseOrg}
                  onChange={(e) => setNewCourseOrg(e.target.value)}
                  placeholder="Ej: unrn-prog2-2026"
                  className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-white"
                />
              </div>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2.5 rounded-xl transition cursor-pointer"
              >
                Crear Nueva Cátedra
              </button>
            </form>

            {/* Courses List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {courses.map((c) => (
                <div key={c.id} className="bg-neutral-900/40 border border-neutral-800 p-6 rounded-2xl flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">{c.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">Organización: {c.github_org || "Ninguna"}</p>
                    <p className="text-xs text-amber-500 mt-1 font-mono">Código: {c.invite_code}</p>
                  </div>
                  <div className="mt-4 flex space-x-2">
                    <button
                      onClick={() => viewCourseDetails(c.id)}
                      className="px-4 py-2 bg-neutral-850 hover:bg-neutral-800 rounded-xl text-xs font-medium border border-neutral-800 transition cursor-pointer"
                    >
                      Ver Detalle
                    </button>
                  </div>
                </div>
              ))}
              {courses.length === 0 && (
                <p className="text-gray-500 text-sm col-span-2">No hay cátedras registradas en la base de datos.</p>
              )}
            </div>
          </div>
        )}

        {/* 2. ADMIN USERS */}
        {activeTab === "admin-users" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Usuarios Registrados</h2>
            <div className="overflow-x-auto bg-neutral-900/40 border border-neutral-800 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-950/40 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="p-4">Nombre</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Rol</th>
                    <th className="p-4">Matrícula</th>
                    <th className="p-4">Cohorte</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-850 text-sm text-gray-300">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="p-4 font-medium text-white">{u.full_name || "-"}</td>
                      <td className="p-4">{u.email}</td>
                      <td className="p-4 capitalize">{u.role}</td>
                      <td className="p-4 font-mono">{u.matricula_unrn || "-"}</td>
                      <td className="p-4">{u.cohorte || "-"}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          u.account_status === "approved" ? "bg-green-950/50 text-green-400" : "bg-amber-950/50 text-amber-400"
                        }`}>
                          {u.account_status === "approved" ? "Aprobado" : "Pendiente"}
                        </span>
                      </td>
                      <td className="p-4">
                        {u.account_status === "pending" && (
                          <button
                            onClick={() => handleApproveUser(u.id)}
                            className="bg-green-600 hover:bg-green-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer"
                          >
                            Aprobar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-gray-500">Cargando usuarios...</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. ADMIN SETTINGS */}
        {activeTab === "admin-settings" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Configuración Global del Sistema</h2>
            <form onSubmit={handleSaveSettings} className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  URL de Calendario Global (.ics)
                </label>
                <input
                  type="url"
                  value={globalCalendarUrl}
                  onChange={(e) => setGlobalCalendarUrl(e.target.value)}
                  placeholder="https://example.com/calendar.ics"
                  className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-white"
                />
              </div>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition cursor-pointer"
              >
                Guardar Configuración
              </button>
            </form>
          </div>
        )}

        {/* 4. TEACHER COURSES */}
        {activeTab === "teacher-courses" && !selectedCourse && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Mis Cátedras Asignadas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {courses.map((c) => (
                <div key={c.id} className="bg-neutral-900/40 border border-neutral-800 p-6 rounded-2xl flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">{c.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">Organización: {c.github_org || "No vinculada"}</p>
                    <div className="mt-3 flex items-center space-x-2">
                      <span className="text-xs text-gray-400">Código de Invitación Estudiante:</span>
                      <span className="text-sm text-blue-400 font-mono font-bold tracking-wider">{c.invite_code}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex space-x-2">
                    <button
                      onClick={() => viewCourseDetails(c.id)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                      Ingresar a Cátedra
                    </button>
                  </div>
                </div>
              ))}
              {courses.length === 0 && (
                <p className="text-gray-500 text-sm">No tienes materias asignadas actualmente. Comunícate con el Administrador.</p>
              )}
            </div>
          </div>
        )}

        {/* 5. STUDENT COURSES */}
        {activeTab === "student-courses" && !selectedCourse && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <h2 className="text-2xl font-bold">Mis Cursadas</h2>
              
              {/* Enroll Course by Invitation Code */}
              <form onSubmit={handleEnrollCourse} className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={enrollCode}
                  onChange={(e) => setEnrollCode(e.target.value)}
                  placeholder="Código Cátedra (6 digitos)"
                  className="bg-neutral-900/60 border border-neutral-800 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-blue-500 uppercase font-mono tracking-widest text-center text-white"
                  required
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition cursor-pointer"
                >
                  Unirse
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {courses.map((c) => (
                <div key={c.id} className="bg-neutral-900/40 border border-neutral-800 p-6 rounded-2xl flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">{c.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">Organización de Trabajo: {c.github_org || "No configurada"}</p>
                  </div>
                  <div className="mt-4 flex space-x-2">
                    <button
                      onClick={() => viewCourseDetails(c.id)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                      Ingresar
                    </button>
                  </div>
                </div>
              ))}
              {courses.length === 0 && (
                <p className="text-gray-500 text-sm">No te has sumado a ninguna cursada todavía. Usa el código de cátedra arriba.</p>
              )}
            </div>
          </div>
        )}

        {/* 6. PROFILE TAB */}
        {activeTab === "profile" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Datos Académicos y Perfil</h2>
            <form onSubmit={handleUpdateProfile} className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nombre Completo</label>
                <input
                  type="text"
                  value={profile?.full_name || ""}
                  disabled
                  className="w-full bg-neutral-950/40 border border-neutral-850 rounded-xl px-4 py-2.5 text-sm text-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Correo Primario</label>
                <input
                  type="text"
                  value={profile?.email || ""}
                  disabled
                  className="w-full bg-neutral-950/40 border border-neutral-850 rounded-xl px-4 py-2.5 text-sm text-gray-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Matrícula UNRN</label>
                  <input
                    type="text"
                    value={profileMatricula}
                    onChange={(e) => setProfileMatricula(e.target.value)}
                    placeholder="Ej: UNRN-12345"
                    className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Cohorte / Año de Ingreso</label>
                  <input
                    type="text"
                    value={profileCohorte}
                    onChange={(e) => setProfileCohorte(e.target.value)}
                    placeholder="Ej: 2026"
                    className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-white"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition cursor-pointer"
              >
                Guardar Cambios
              </button>
            </form>
          </div>
        )}

        {/* COURSE DETAIL VIEW (SHARED) */}
        {selectedCourse && (
          <div className="space-y-6">
            <div className="flex items-center space-x-2 text-sm text-gray-400 mb-2">
              <button onClick={() => setSelectedCourse(null)} className="hover:text-white underline transition">
                Volver
              </button>
              <span>/</span>
              <span className="text-gray-300 font-semibold">{selectedCourse.name || selectedCourse.course?.name}</span>
            </div>

            <div className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800">
              <h2 className="text-2xl font-bold">{selectedCourse.name || selectedCourse.course?.name}</h2>
              <p className="text-sm text-gray-400 mt-2">
                Organización de GitHub vinculada: <strong>{selectedCourse.github_org || selectedCourse.course?.github_org || "No asignada"}</strong>
              </p>
              {selectedCourse.invite_code && (
                <p className="text-sm text-amber-500 font-mono mt-1">
                  Código de invitación estudiantes: <strong>{selectedCourse.invite_code}</strong>
                </p>
              )}
            </div>

            {/* Roster & extra data */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Classes/Syllabus */}
              <div className="bg-neutral-900/40 border border-neutral-800 p-6 rounded-2xl">
                <h3 className="text-lg font-semibold text-white mb-3">Cronograma de Clases</h3>
                <div className="space-y-2">
                  <p className="text-sm text-gray-400">Próximamente se integrará el calendario interactivo.</p>
                </div>
              </div>

              {/* Assignments / Tareas */}
              <div className="bg-neutral-900/40 border border-neutral-800 p-6 rounded-2xl">
                <h3 className="text-lg font-semibold text-white mb-3">Tareas de la Cátedra</h3>
                <div className="space-y-2">
                  <p className="text-sm text-gray-400">Próximamente se mostrarán las asignaciones y entregas de GitHub Classroom.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
