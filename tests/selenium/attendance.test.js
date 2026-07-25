const { createDriver, BASE_URL, assert, assertEqual, By, until } = require("./config");

async function runAttendanceTests() {
  console.log("\n📱 --- Ejecutando Tests Selenium: Presentismo por QR y Código ---");
  const driver = await createDriver();
  let passed = 0;
  let total = 0;

  try {
    await driver.get(`${BASE_URL}/dashboard`);
    await driver.wait(until.elementLocated(By.id("btn-open-qr-modal")), 5000);

    // TEST 7.1: Abrir Modal QR, verificar estado de validación del botón confirmación
    total++;
    console.log("  [Test 7.1] Validación del token de 6 caracteres para firmar presente...");
    const btnOpenQr = await driver.findElement(By.id("btn-open-qr-modal"));
    await btnOpenQr.click();
    await driver.sleep(200);

    const qrModal = await driver.findElement(By.id("qr-modal"));
    assert(await qrModal.isDisplayed(), "El modal de presentismo QR debe ser visible");

    const tokenInput = await driver.findElement(By.id("qr-token-input"));
    const confirmBtn = await driver.findElement(By.id("btn-confirm-qr"));

    // Incomplete code (3 chars) -> Button must be disabled
    await tokenInput.sendKeys("A7B");
    assert(await confirmBtn.getAttribute("disabled") !== null, "El botón debe estar deshabilitado para tokens incompletos (<6 chars)");

    // Complete code (6 chars) -> Button must enable
    await tokenInput.sendKeys("9X2");
    assert(await confirmBtn.getAttribute("disabled") === null, "El botón debe habilitarse al ingresar 6 caracteres exactos");
    console.log("    ✓ Pasado: Validación estricta de token de 6 caracteres comprobada.");
    passed++;

    // TEST 7.2: Confirmar presente y verificar toast de éxito
    total++;
    console.log("  [Test 7.2] Confirmar asistencia y verificar notificación Toast...");
    await confirmBtn.click();
    await driver.sleep(200);

    assert(!(await qrModal.isDisplayed()), "El modal QR debe cerrarse tras confirmar presente");

    const toastMsg = await driver.findElement(By.id("toast-msg")).getText();
    assert(toastMsg.includes("Presente firmado"), "Debe notificar la firma del presente exitosa");
    console.log("    ✓ Pasado: Confirmación de asistencia e integración con Toast verificantas.");
    passed++;

  } catch (err) {
    console.error("  ❌ FALLO en Attendance Test:", err.message);
  } finally {
    await driver.quit();
  }

  return { name: "Presentismo por QR y Código", passed, total };
}

module.exports = runAttendanceTests;
