import { httpsCallable } from "firebase/functions";
import { signOut } from "firebase/auth";
import { auth, functions } from "@/lib/firebase/clientApp";

const apiCall = httpsCallable(functions, "api");

/** Código semántico de un error de la API (`details.code` del backend). */
export function apiErrorCode(err: unknown): string | undefined {
  const details = (err as { details?: { code?: unknown } } | null)?.details;
  return typeof details?.code === "string" ? details.code : undefined;
}

export const api = async (action: string, payload: any = {}) => {
  try {
    const res = await apiCall({ action, payload });
    return res.data as any;
  } catch (err) {
    // Sesión revocada (cambio de contraseña o "cerrar sesión en todos los
    // dispositivos"): se cierra la sesión local y se vuelve al login.
    if (apiErrorCode(err) === "AUTH_SESSION_REVOKED" && typeof window !== "undefined") {
      await signOut(auth).catch(() => {});
      window.location.assign("/login?reason=session_revoked");
    }
    throw err;
  }
};
