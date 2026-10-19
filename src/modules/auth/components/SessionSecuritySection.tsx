"use client";

import { useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, signOut, updatePassword } from "firebase/auth";
import { auth } from "@/lib/firebase/clientApp";
import { api } from "@/lib/api";
import { showToast } from "@/components/dashboard/ui/ToastNotification";
import { confirmAction } from "@/components/dashboard/ui/ConfirmDialog";

/**
 * Cambio de contraseña y cierre de sesión en todos los dispositivos
 * (mejora 3.29). Al cambiar la contraseña Firebase revoca los refresh
 * tokens y el backend rechaza los ID tokens anteriores.
 */
export default function SessionSecuritySection() {
  const usesPassword = Boolean(auth.currentUser?.providerData.some((p) => p.providerId === "password"));
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user?.email) return;
    if (next.length < 8) {
      showToast("La contraseña nueva debe tener al menos 8 caracteres.", "error");
      return;
    }
    setBusy(true);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
      await updatePassword(user, next);
      setCurrent("");
      setNext("");
      showToast("Contraseña actualizada. Se cerraron tus sesiones en otros dispositivos.", "success");
    } catch (err: any) {
      const msg = err?.code === "auth/wrong-password" || err?.code === "auth/invalid-credential"
        ? "La contraseña actual no es correcta."
        : err?.code === "auth/weak-password" ? "La contraseña nueva es demasiado débil." : err?.message;
      showToast("No se pudo cambiar la contraseña: " + msg, "error");
    } finally {
      setBusy(false);
    }
  };

  const handleSignOutEverywhere = async () => {
    const ok = await confirmAction({ message: "¿Cerrar tu sesión en todos los dispositivos, incluido este?", tone: "danger" });
    if (!ok) return;
    setBusy(true);
    try {
      await api("signOutEverywhere");
      await signOut(auth);
      window.location.assign("/login?reason=signed_out_everywhere");
    } catch (err: any) {
      showToast("No se pudieron cerrar las sesiones: " + err.message, "error");
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="session-security-title" className="space-y-4">
      <h3 id="session-security-title" className="text-sm font-bold text-text-primary uppercase tracking-wider border-b border-border-custom pb-2">
        🛡️ Contraseña y sesiones
      </h3>
      {usesPassword ? (
        <form onSubmit={handleChangePassword} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label htmlFor="currentPassword" className="block text-xs font-semibold text-text-secondary mb-1">Contraseña actual</label>
            <input id="currentPassword" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required className="w-full bg-bg-primary border border-border-custom rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label htmlFor="newPassword" className="block text-xs font-semibold text-text-secondary mb-1">Contraseña nueva (mín. 8)</label>
            <input id="newPassword" type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required className="w-full bg-bg-primary border border-border-custom rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-blue-500" />
          </div>
          <button type="submit" disabled={busy} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50">Cambiar contraseña</button>
        </form>
      ) : (
        <p className="text-xs text-text-secondary">Ingresás con Google o GitHub: la contraseña se gestiona en ese proveedor.</p>
      )}
      <div className="pt-2 border-t border-border-custom">
        <button type="button" onClick={handleSignOutEverywhere} disabled={busy} className="px-4 py-2 border border-border-custom rounded-xl text-xs font-semibold text-text-primary hover:bg-bg-tertiary cursor-pointer disabled:opacity-50">
          Cerrar sesión en todos los dispositivos
        </button>
      </div>
    </section>
  );
}
