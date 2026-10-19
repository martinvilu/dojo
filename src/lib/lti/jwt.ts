/**
 * JWT RS256 para LTI 1.3 con node:crypto (mejora 3.12), sin dependencias.
 *
 * - verifyPlatformJwt: valida el id_token que firma la plataforma (Moodle)
 *   contra su JWKS público: algoritmo, firma, emisor, audiencia y vigencia.
 * - signToolJwt: firma los mensajes de la herramienta (respuesta de Deep
 *   Linking) con la clave privada de Ninja Dojo.
 */
import { createPrivateKey, createPublicKey, createSign, createVerify, type KeyObject, type JsonWebKey } from "node:crypto";

export interface JwtParts {
  header: Record<string, any>;
  payload: Record<string, any>;
  signingInput: string;
  signature: Buffer;
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

export function decodeJwt(token: string): JwtParts {
  const parts = typeof token === "string" ? token.split(".") : [];
  if (parts.length !== 3) throw new Error("JWT mal formado");
  try {
    return {
      header: JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")),
      payload: JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")),
      signingInput: `${parts[0]}.${parts[1]}`,
      signature: Buffer.from(parts[2], "base64url"),
    };
  } catch {
    throw new Error("JWT mal formado");
  }
}

export type JwksFetcher = (url: string) => Promise<{ keys: JsonWebKey[] }>;

const JWKS_TTL_MS = 10 * 60 * 1000;
const jwksCache = new Map<string, { keys: JsonWebKey[]; fetchedAt: number }>();

async function defaultFetcher(url: string) {
  const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo obtener el JWKS de la plataforma (HTTP ${res.status})`);
  return res.json();
}

async function platformKey(jwksUrl: string, kid: string | undefined, fetcher: JwksFetcher, now: number): Promise<KeyObject> {
  const find = (keys: JsonWebKey[]) => keys.find((k: any) => (kid ? k.kid === kid : true) && (!k.use || k.use === "sig"));
  let cached = jwksCache.get(jwksUrl);
  let jwk = cached && now - cached.fetchedAt < JWKS_TTL_MS ? find(cached.keys) : undefined;
  if (!jwk) {
    // Clave nueva (rotación) o caché vencida: se vuelve a pedir el JWKS.
    const { keys } = await fetcher(jwksUrl);
    cached = { keys: Array.isArray(keys) ? keys : [], fetchedAt: now };
    jwksCache.set(jwksUrl, cached);
    jwk = find(cached.keys);
  }
  if (!jwk) throw new Error("La plataforma no publica una clave para este token");
  return createPublicKey({ key: jwk, format: "jwk" });
}

export interface VerifyOptions {
  jwksUrl: string;
  issuer: string;
  audience: string;
  now?: number;
  clockToleranceSec?: number;
  fetcher?: JwksFetcher;
}

export async function verifyPlatformJwt(token: string, opts: VerifyOptions): Promise<Record<string, any>> {
  const { header, payload, signingInput, signature } = decodeJwt(token);
  if (header.alg !== "RS256") throw new Error(`Algoritmo no permitido: ${header.alg}`);
  const now = opts.now ?? Date.now();
  const key = await platformKey(opts.jwksUrl, header.kid, opts.fetcher ?? defaultFetcher, now);
  const verifier = createVerify("RSA-SHA256");
  verifier.update(signingInput);
  if (!verifier.verify(key, signature)) throw new Error("Firma del token inválida");

  const tolerance = opts.clockToleranceSec ?? 60;
  const nowSec = Math.floor(now / 1000);
  if (payload.iss !== opts.issuer) throw new Error("Emisor del token inválido");
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(opts.audience)) throw new Error("Audiencia del token inválida");
  if (aud.length > 1 && payload.azp && payload.azp !== opts.audience) throw new Error("azp del token inválido");
  if (typeof payload.exp !== "number" || payload.exp + tolerance < nowSec) throw new Error("Token vencido");
  if (typeof payload.iat === "number" && payload.iat - tolerance > nowSec) throw new Error("Token emitido en el futuro");
  return payload;
}

export function loadPrivateKey(pem?: string | null): KeyObject | null {
  if (!pem) return null;
  return createPrivateKey(pem.includes("\\n") ? pem.replace(/\\n/g, "\n") : pem);
}

export function publicJwkFromPrivate(privateKey: KeyObject, kid: string): JsonWebKey {
  const jwk = createPublicKey(privateKey).export({ format: "jwk" }) as JsonWebKey;
  return { ...jwk, kid, use: "sig", alg: "RS256" } as JsonWebKey;
}

export function signToolJwt(payload: Record<string, any>, privateKey: KeyObject, kid: string): string {
  const header = { alg: "RS256", typ: "JWT", kid };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  return `${signingInput}.${signer.sign(privateKey).toString("base64url")}`;
}

/** Solo para tests: vacía la caché de JWKS. */
export function clearJwksCache() {
  jwksCache.clear();
}
