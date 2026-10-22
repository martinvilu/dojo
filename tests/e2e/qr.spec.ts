import { test, expect } from "@playwright/test";
import { COURSE_PATH, callApi, login } from "./helpers";

const AULA = { latitude: -41.1335, longitude: -71.3103 };

test.use({ geolocation: AULA, permissions: ["geolocation"] });

/** Plan F1.3: QR con código rotativo generado en el backend y dibujado en el navegador. */
test("el docente proyecta el QR y un alumno firma con el código vigente", async ({ page }) => {
  await login(page, "titular@e2e.test");
  await page.goto(`${COURSE_PATH}/cronograma`);
  await page.getByRole("button", { name: /Control de Asistencia/ }).first().click();
  await page.getByRole("button", { name: /Generar QR Dinámico/ }).click();

  const dialog = page.getByRole("dialog", { name: /Presentismo por código QR/ });
  await expect(dialog).toBeVisible();
  const img = dialog.getByRole("img", { name: /Código QR de asistencia/ });
  await expect(img).toHaveAttribute("src", /^data:image\/png;base64,/);
  const code = (await dialog.locator(".font-mono.tracking-widest").innerText()).trim();
  expect(code).toMatch(/^[A-Z2-9]{6}$/);

  const signed = await callApi("ana@e2e.test", "submitQrAttendance", { courseId: "e2e-prog1", classNumber: 1, token: code, lat: AULA.latitude, lng: AULA.longitude });
  expect(signed.error).toBeUndefined();
  expect(signed.result).toMatchObject({ success: true });

  const far = await callApi("beto@e2e.test", "submitQrAttendance", { courseId: "e2e-prog1", classNumber: 1, token: code, lat: -34.6, lng: -58.4 });
  expect(far.error?.message).toMatch(/demasiado lejos/);
  const wrong = await callApi("beto@e2e.test", "submitQrAttendance", { courseId: "e2e-prog1", classNumber: 1, token: "AAAAAA", lat: AULA.latitude, lng: AULA.longitude });
  expect(wrong.error?.message).toMatch(/venció o no es válido/);
});
