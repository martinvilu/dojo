/** Descripción legible y corta de un user agent ("Chrome en Android"). */
export function describeUserAgent(ua?: string | null): string {
  if (!ua) return "Dispositivo desconocido";
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\/|Opera/.test(ua) ? "Opera" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Safari\//.test(ua) ? "Safari" : "Navegador";
  const os =
    /Android/.test(ua) ? "Android" :
    /iPhone|iPad|iPod/.test(ua) ? "iOS" :
    /Windows/.test(ua) ? "Windows" :
    /Mac OS X|Macintosh/.test(ua) ? "macOS" :
    /CrOS/.test(ua) ? "ChromeOS" :
    /Linux/.test(ua) ? "Linux" : "otro sistema";
  return `${browser} en ${os}`;
}

const PROVIDERS: Record<string, string> = {
  password: "correo y contraseña",
  "google.com": "Google",
  "github.com": "GitHub",
};

export function describeProvider(provider?: string | null): string {
  return (provider && PROVIDERS[provider]) || provider || "desconocido";
}
