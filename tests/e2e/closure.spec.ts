import { test, expect } from "@playwright/test";
import { COURSE_PATH, callApi, login } from "./helpers";

/** UC-D17: cierre de cursada con acta congelada, CSV SIU y reapertura. */
test.describe.serial("cierre de cursada", () => {
  test("el titular congela el acta y descarga el CSV para SIU", async ({ page }) => {
    await login(page, "titular@e2e.test");
    await page.goto(`${COURSE_PATH}/cursada`);
    await page.getByRole("tab", { name: "Cierre" }).click();
    await expect(page.getByText("Casos borde")).toBeVisible({ timeout: 60_000 });

    await page.getByRole("button", { name: /Cerrar cursada y congelar acta/ }).click();
    await page.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText("Cerrada · acta v1")).toBeVisible();
    await expect(page.getByText("✔ íntegra")).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /CSV para SIU Guaraní/ }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^acta_Programacion_I_v1_[0-9a-f]{12}\.csv$/);
    const csv = await (await file.createReadStream()).toArray();
    const text = Buffer.concat(csv).toString("utf8");
    expect(text).toContain("UNRN-10002;Beto Paz;Comisión 2;Libre;");
  });

  test("con el acta cerrada no se cargan notas y el alumno ve su condición final", async ({ page }) => {
    const blocked = await callApi("titular@e2e.test", "gradeAssessment", { assessmentId: "e2e-p1", studentId: "e2e-beto", grade: 9 });
    expect(blocked.error?.status).toBe("FAILED_PRECONDITION");

    await login(page, "beto@e2e.test");
    await page.goto(`${COURSE_PATH}/cursada`);
    await expect(page.getByText(/En el acta figurás como/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Libre", { exact: true })).toBeVisible();
  });

  test("reabrir exige un motivo y conserva la versión anterior", async ({ page }) => {
    await login(page, "titular@e2e.test");
    await page.goto(`${COURSE_PATH}/cursada`);
    await page.getByRole("tab", { name: "Cierre" }).click();
    await page.getByLabel("Motivo para reabrir").fill("Corrección de la nota del P1 de Beto");
    await page.getByRole("button", { name: "Reabrir cursada" }).click();
    await expect(page.getByText(/Reabierta \(acta v1 guardada\)/)).toBeVisible();
    await expect(page.getByText("Acta v1", { exact: true })).toBeVisible();
  });
});
