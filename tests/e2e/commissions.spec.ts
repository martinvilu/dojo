import { test, expect } from "@playwright/test";
import { COURSE_PATH, callApi, login } from "./helpers";

/** Plan F0.4: el ayudante de Comisión 1 no ve ni opera sobre Comisión 2. */
test.describe("ayudante restringido a su comisión", () => {
  test("la tabla de condiciones solo muestra su comisión", async ({ page }) => {
    await login(page, "ayudante@e2e.test");
    await page.goto(`${COURSE_PATH}/cursada`);
    await expect(page.getByRole("button", { name: /Ana Díaz/ })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: /Beto Paz/ })).toHaveCount(0);
  });

  test("el backend rechaza asistencia y notas de otra comisión", async () => {
    const attendance = await callApi("ayudante@e2e.test", "saveClassAttendance", { courseId: "e2e-prog1", classNumber: 4, records: { "e2e-beto": "present" } });
    expect(attendance.error?.status).toBe("PERMISSION_DENIED");
    const grade = await callApi("ayudante@e2e.test", "gradeAssessment", { assessmentId: "e2e-p1", studentId: "e2e-beto", grade: 10 });
    expect(grade.error?.status).toBe("PERMISSION_DENIED");
    const own = await callApi("ayudante@e2e.test", "saveClassAttendance", { courseId: "e2e-prog1", classNumber: 4, records: { "e2e-ana": "present" } });
    expect(own.result).toMatchObject({ success: true, updated: 1 });
  });

  test("el titular ve a toda la cursada", async ({ page }) => {
    await login(page, "titular@e2e.test");
    await page.goto(`${COURSE_PATH}/cursada`);
    await expect(page.getByRole("button", { name: /Beto Paz/ })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: /Ana Díaz/ })).toBeVisible();
  });
});
