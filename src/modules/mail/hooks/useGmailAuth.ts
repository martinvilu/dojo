import { useState, useEffect, useCallback } from "react";
import { showToast } from "@/components/dashboard/ui/ToastNotification";

export function useGmailAuth(api: (action: string, payload?: any) => Promise<any>) {
  const [gmailStatus, setGmailStatus] = useState<{ connected: boolean; email: string | null }>({
    connected: false,
    email: null,
  });
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const status = await api("getGmailAuthStatus");
      setGmailStatus(status || { connected: false, email: null });
    } catch (e: any) {
      console.error("Error fetching Gmail status:", e);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");
    if (code) {
      const handleExchange = async () => {
        try {
          const redirectUri = window.location.origin + "/dashboard?tab=settings";
          const res = await api("saveGmailAuthCode", { code, redirectUri });
          showToast(`¡Cuenta de Gmail (${res.email}) vinculada exitosamente!`, "success");
          
          const url = new URL(window.location.href);
          url.searchParams.delete("code");
          url.searchParams.delete("scope");
          url.searchParams.delete("authuser");
          url.searchParams.delete("prompt");
          window.history.replaceState({}, document.title, url.toString());
          
          setGmailStatus({ connected: true, email: res.email });
        } catch (err: any) {
          showToast("Error al vincular cuenta de Gmail: " + err.message, "error");
        }
      };
      handleExchange();
    }
  }, [api]);

  const handleStartAuth = async () => {
    try {
      const redirectUri = window.location.origin + "/dashboard?tab=settings";
      const res = await api("getGmailAuthUrl", { redirectUri });
      if (res && res.authUrl) {
        window.location.href = res.authUrl;
      }
    } catch (err: any) {
      showToast("Error al iniciar autorización con Gmail: " + err.message, "error");
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("¿Estás seguro de desvincular tu cuenta de Gmail? No se podrán enviar notificaciones desde tu correo.")) return;
    
    try {
      await api("disconnectGmailAuth");
      setGmailStatus({ connected: false, email: null });
      showToast("Cuenta de Gmail desvinculada.", "success");
    } catch (err: any) {
      showToast("Error al desvincular Gmail: " + err.message, "error");
    }
  };

  const handleSendTest = async () => {
    const testEmailAddress = prompt("Ingresá el correo de destino para la prueba:", gmailStatus.email || "");
    if (!testEmailAddress) {
      showToast("Ingresá un correo de destino válido.", "warning");
      return;
    }
    try {
      const res = await api("sendGmailNotification", {
        to: testEmailAddress,
        subject: "🔔 Prueba de Envío desde Dojo via Gmail API",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #10b981;">¡Conexión Exitosa!</h2>
            <p>Hola, este correo de prueba fue enviado desde tu cuenta vinculada (<strong>${gmailStatus.email}</strong>) mediante la <strong>Gmail API</strong> oficial.</p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">Dojo Ninja Classroom</p>
          </div>
        `
      });
      showToast(`¡Correo de prueba enviado exitosamente a ${testEmailAddress} desde ${res.emailSentFrom}!`, "success");
    } catch (err: any) {
      showToast("Error al enviar correo de prueba: " + err.message, "error");
    }
  };

  return {
    gmailStatus,
    setGmailStatus,
    loading,
    refreshStatus: fetchStatus,
    handleStartAuth,
    handleDisconnect,
    handleSendTest
  };
}
