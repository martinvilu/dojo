import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { login } from "./helpers";

/** Violaciones WCAG 2.1 A/AA graves o críticas (SPEC §4). */
async function seriousViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (process.env.E2E_DEBUG_A11Y) for (const v of serious) for (const n of v.nodes) console.log(`[axe] ${v.id}: ${n.html.slice(0, 200)}\n      ${n.failureSummary}`);
  return serious
    .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 5).map((n) => n.target.join(" ")).join(" | ")}`);
}

test("login sin violaciones graves de accesibilidad", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("#password")).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

test("el dashboard del docente carga sin violaciones graves de accesibilidad", async ({ page }) => {
  await login(page, "titular@e2e.test");
  await expect(page.getByText("Programación I").first()).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

test("el dashboard en tema claro tampoco tiene violaciones graves", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await login(page, "titular@e2e.test");
  await expect(page.getByText("Programación I").first()).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});
