"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/clientApp";
import { api } from "@/lib/api";
import { showToast } from "@/components/dashboard/ui/ToastNotification";

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "teacher" | "student";
  avatar_url?: string;
  account_status: "pending" | "approved";
  matricula_unrn?: string;
  cohorte?: string;
  github_user?: string;
}

interface UseAuthProfileArgs {
  setActiveTab: (tab: string) => void;
  setApiLoading: (v: boolean) => void;
  setError: (msg: string) => void;
}

/**
 * Session and profile domain: Firebase auth listener, profile loading with
 * retry, pending-matrícula gate, profile edit form state and actions.
 */
export function useAuthProfile({ setActiveTab, setApiLoading, setError }: UseAuthProfileArgs) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Pending Matricula inputs
  const [matriculaInput, setMatriculaInput] = useState("");
  const [matriculaError, setMatriculaError] = useState("");

  // Profile Edit state
  const [profileName, setProfileName] = useState("");
  const [profileMatricula, setProfileMatricula] = useState("");
  const [profileCohorte, setProfileCohorte] = useState("");
  const [profileGithubUser, setProfileGithubUser] = useState("");
  const [xpLogs, setXpLogs] = useState<any[]>([]);

  // Fetch profiles and manage auth status
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login?redirect=" + encodeURIComponent(window.location.pathname + window.location.search));
        return;
      }
      setCurrentUser(user);
      try {
        let profileRes = await api("getProfile");
        if (!profileRes) {
          await new Promise((r) => setTimeout(r, 2000));
          profileRes = await api("getProfile");
        }

        const userProfile = profileRes as UserProfile;
        setProfile(userProfile);

        if (userProfile.account_status === "approved" || userProfile.role === "admin" || userProfile.role === "teacher") {
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
    // Router is stable across renders; the listener must be registered once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiLoading(true);
    try {
      await api("updateProfile", {
        full_name: profileName,
        matricula_unrn: profileMatricula,
        cohorte: profileCohorte,
        github_user: profileGithubUser
      });
      const profileRes = await api("getProfile");
      setProfile(profileRes);
      showToast("Perfil actualizado correctamente.", "success");
    } catch (err: any) {
      setError("Error al actualizar perfil: " + err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const handleAddSecondaryEmail = async (email: string) => {
    setApiLoading(true);
    try {
      await api("addSecondaryEmail", { email });
      const profileRes = await api("getProfile");
      setProfile(profileRes);
      showToast("Correo secundario vinculado exitosamente.", "success");
    } catch (err: any) {
      showToast("Error al vincular correo secundario: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  return {
    currentUser, profile, setProfile, loading,
    matriculaInput, setMatriculaInput, matriculaError,
    profileName, setProfileName, profileMatricula, setProfileMatricula,
    profileCohorte, setProfileCohorte, profileGithubUser, setProfileGithubUser,
    xpLogs, setXpLogs,
    handleLogout, handleSubmitMatricula, handleUpdateProfile, handleAddSecondaryEmail
  };
}
