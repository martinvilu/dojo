"use client";

import { User } from "firebase/auth";
import type { UserProfile } from "../hooks/useAuthProfile";

interface SidebarProps {
  profile: UserProfile | null;
  currentUser: User | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (v: boolean) => void;
  isProfileMenuOpen: boolean;
  setIsProfileMenuOpen: (v: boolean) => void;
  theme: string;
  toggleTheme: () => void;
  onLogout: () => void;
  onOpenQrScanner: () => void;
}

export function Sidebar({
  profile, currentUser, activeTab, setActiveTab,
  isSidebarCollapsed, setIsSidebarCollapsed,
  isProfileMenuOpen, setIsProfileMenuOpen,
  theme, toggleTheme,
  onLogout, onOpenQrScanner
}: SidebarProps) {
  return (
    <aside className={`w-full ${
      isSidebarCollapsed ? "md:w-20" : "md:w-64"
    } bg-bg-secondary border-b md:border-b-0 md:border-r border-border-custom flex flex-col p-6 space-y-6 transition-all duration-300 relative`}>
      {/* Collapse Toggle Button (Desktop Only) */}
      <button
        type="button"
        aria-label={isSidebarCollapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
        aria-expanded={!isSidebarCollapsed}
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        className="hidden md:flex absolute top-5 -right-3.5 bg-bg-secondary border border-border-custom text-text-secondary hover:text-text-primary p-1.5 rounded-full z-50 shadow-md cursor-pointer transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      >
        <span aria-hidden="true">{isSidebarCollapsed ? "▶" : "◀"}</span>
      </button>

      <div className="overflow-hidden">
        <h1 className="text-xl font-bold bg-gradient-to-r from-red-400 to-amber-500 bg-clip-text text-transparent truncate">
          {isSidebarCollapsed ? "🥷" : "Ninja Dojo"}
        </h1>
        {!isSidebarCollapsed && (
          <p className="text-xs text-text-secondary mt-1 uppercase tracking-wider font-semibold truncate animate-fade-in">
            {profile?.role === "admin" ? "Administrador" : profile?.role === "teacher" ? "Profesor" : "Estudiante"}
          </p>
        )}
      </div>

      {/* Clickable User Profile Badge with floating menu */}
      <div className="relative">
        <button
          type="button"
          aria-label="Menú de perfil de usuario"
          aria-haspopup="menu"
          aria-expanded={isProfileMenuOpen}
          onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
          className="w-full flex items-center space-x-3 bg-bg-primary/50 p-3 rounded-xl border border-border-custom cursor-pointer hover:bg-bg-tertiary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 text-left"
        >
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white uppercase overflow-hidden text-sm shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
            ) : (
              profile?.full_name?.substring(0, 2) || "U"
            )}
          </div>
          {!isSidebarCollapsed && (
            <div className="overflow-hidden text-left animate-fade-in">
              <h4 className="text-sm font-semibold text-text-primary truncate">{profile?.full_name}</h4>
              <p className="text-xs text-text-secondary truncate">{currentUser?.email}</p>
            </div>
          )}
        </button>

        {/* FLOATING PROFILE MENU (POPOVER) */}
        {isProfileMenuOpen && (
          <>
            {/* Overlay blocker */}
            <div className="fixed inset-0 z-40" onClick={() => setIsProfileMenuOpen(false)}></div>
            <div className={`absolute ${
              isSidebarCollapsed
                ? "md:left-14 md:-bottom-2 md:right-auto md:w-56"
                : "md:left-2 md:right-2 md:-bottom-2 md:translate-y-full"
            } bottom-18 left-0 right-0 bg-bg-secondary border border-border-custom p-3 rounded-2xl shadow-2xl z-50 space-y-1.5 animate-fade-in text-left`}>
              <button
                onClick={() => {
                  setActiveTab("profile");
                  setIsProfileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition cursor-pointer flex items-center space-x-2"
              >
                <span>👤</span>
                <span>Mi Perfil</span>
              </button>
              <button
                onClick={() => {
                  toggleTheme();
                  setIsProfileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition cursor-pointer flex items-center space-x-2"
              >
                <span>{theme === "light" ? "🌙" : "☀️"}</span>
                <span>{theme === "light" ? "Modo Oscuro" : "Modo Claro"}</span>
              </button>
              <hr className="border-border-custom my-1" />
              <button
                onClick={() => {
                  onLogout();
                  setIsProfileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold bg-red-950/20 hover:bg-red-900/30 text-red-600 dark:text-red-400 transition cursor-pointer flex items-center space-x-2"
              >
                <span>🚪</span>
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {profile?.role === "admin" && (
          <>
            <button
              onClick={() => setActiveTab("admin-courses")}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer flex items-center space-x-3 ${
                activeTab === "admin-courses" ? "bg-blue-600 text-white" : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
              }`}
            >
              <span>🏫</span>
              {!isSidebarCollapsed && <span>Cátedras</span>}
            </button>
            <button
              onClick={() => setActiveTab("admin-users")}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer flex items-center space-x-3 ${
                activeTab === "admin-users" ? "bg-blue-600 text-white" : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
              }`}
            >
              <span>👥</span>
              {!isSidebarCollapsed && <span>Usuarios</span>}
            </button>
            <button
              onClick={() => setActiveTab("admin-settings")}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer flex items-center space-x-3 ${
                activeTab === "admin-settings" ? "bg-blue-600 text-white" : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
              }`}
            >
              <span>⚙️</span>
              {!isSidebarCollapsed && <span>Configuración</span>}
            </button>
            <button
              onClick={() => setActiveTab("admin-backups")}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer flex items-center space-x-3 ${
                activeTab === "admin-backups" ? "bg-blue-600 text-white" : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
              }`}
            >
              <span>💾</span>
              {!isSidebarCollapsed && <span>Respaldos</span>}
            </button>
          </>
        )}

        {profile?.role === "teacher" && (
          <>
            <button
              onClick={() => setActiveTab("teacher-courses")}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer flex items-center space-x-3 ${
                activeTab === "teacher-courses" ? "bg-blue-600 text-white" : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
              }`}
            >
              <span>📚</span>
              {!isSidebarCollapsed && <span>Mis Cátedras</span>}
            </button>
          </>
        )}

        {profile?.role === "student" && (
          <>
            <button
              onClick={() => setActiveTab("student-courses")}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer flex items-center space-x-3 ${
                activeTab === "student-courses" ? "bg-blue-600 text-white" : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
              }`}
            >
              <span>📚</span>
              {!isSidebarCollapsed && <span>Mis Cátedras</span>}
            </button>
            <button
              onClick={onOpenQrScanner}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer flex items-center space-x-3 bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 hover:text-emerald-700 dark:hover:text-emerald-300 mt-2`}
            >
              <span>📷</span>
              {!isSidebarCollapsed && <span>Escanear QR</span>}
            </button>
          </>
        )}

        {/* Unified Calendar Tab Link */}
        <button
          onClick={() => setActiveTab("calendar")}
          className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer flex items-center space-x-3 ${
            activeTab === "calendar" ? "bg-blue-600 text-white" : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
          }`}
        >
          <span>📅</span>
          {!isSidebarCollapsed && <span>Calendario Global</span>}
        </button>
      </nav>
    </aside>
  );
}
