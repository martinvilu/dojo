import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Dojo-e2e-1234";
export const COURSE_PATH = "/b6003-programacion-1/2026/1c/todas";
const PROJECT_ID = "demo-ninja-dojo";

export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/correo|email/i).first().fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 });
}

/** ID token del emulador de Auth (sin pasar por la UI). */
export async function idTokenFor(email: string): Promise<string> {
  const res = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  const body = await res.json();
  expect(body.idToken, JSON.stringify(body)).toBeTruthy();
  return body.idToken;
}

/** Llama a la callable `api` del emulador de Functions como `email`. */
export async function callApi(email: string, action: string, payload: unknown) {
  const res = await fetch(`http://127.0.0.1:5001/${PROJECT_ID}/us-central1/api`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await idTokenFor(email)}` },
    body: JSON.stringify({ data: { action, payload } }),
  });
  return res.json() as Promise<{ result?: any; error?: { status: string; message: string } }>;
}
