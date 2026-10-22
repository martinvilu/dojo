/** Siembra los emuladores antes de la corrida (ver scripts/e2e/seed-emulator.js). */
export default async function globalSetup() {
  process.env.GCLOUD_PROJECT ||= "demo-ninja-dojo";
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- script CommonJS compartido con la CLI
  const { seed } = require("../../scripts/e2e/seed-emulator.js");
  await seed();
}
