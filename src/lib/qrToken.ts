/**
 * Derivación de los códigos de asistencia rotativos en el navegador del
 * docente (mejora 3.18). Debe coincidir con `functions/src/lib/qrToken.js`:
 * HMAC-SHA256(secreto, intervalo) -> 6 caracteres de un alfabeto sin
 * caracteres ambiguos. Ambos lados se prueban con el mismo vector.
 */

export const QR_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const QR_CODE_LENGTH = 6;

export function qrStepAt(epochMs: number, periodSeconds: number): number {
  return Math.floor(epochMs / 1000 / periodSeconds);
}

/** Segundos que faltan para que rote el código vigente. */
export function secondsUntilRotation(epochMs: number, periodSeconds: number): number {
  const periodMs = periodSeconds * 1000;
  return Math.ceil((periodMs - (epochMs % periodMs)) / 1000);
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

const keyCache = new Map<string, Promise<CryptoKey>>();

function importKey(secretHex: string): Promise<CryptoKey> {
  let key = keyCache.get(secretHex);
  if (!key) {
    key = crypto.subtle.importKey("raw", hexToBytes(secretHex), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    keyCache.set(secretHex, key);
  }
  return key;
}

export async function qrCodeForStep(secretHex: string, step: number): Promise<string> {
  const key = await importKey(secretHex);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(String(step))));
  let code = "";
  for (let i = 0; i < QR_CODE_LENGTH; i++) code += QR_ALPHABET[digest[i] % QR_ALPHABET.length];
  return code;
}
