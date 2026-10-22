import { defineConfig } from "@playwright/test";

/**
 * E2E contra emuladores reales (Auth + Firestore + Functions), plan F8 / mejora 5.01.
 * Correr con `npm run test:e2e`, que levanta los emuladores y siembra los datos.
 */
const PORT = Number(process.env.E2E_PORT || 3100);
const PROJECT_ID = "demo-ninja-dojo";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // Chrome del sistema: evita descargar navegadores en CI y local.
    channel: "chrome",
    trace: "retain-on-failure",
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
  },
  webServer: {
    command: `npx next dev -p ${PORT} -H 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/login`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "1",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: PROJECT_ID,
      GCLOUD_PROJECT: PROJECT_ID,
      FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080",
      FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099",
      FUNCTIONS_API_URL: `http://127.0.0.1:5001/${PROJECT_ID}/us-central1/api`,
    },
  },
});
