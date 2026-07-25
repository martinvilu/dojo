const { createDriver, BASE_URL, assert, assertEqual, By, until } = require("./config");

async function runTeacherTests() {
  console.log("\n👨‍🏫 --- Ejecutando Tests Selenium: Flujos Específicos del Rol Docente ---");
  const driver = await createDriver();
  let passed = 0;
  let total = 0;

  try {
    await driver.get(`${BASE_URL}/dashboard`);
    await driver.wait(until.elementLocated(By.id("btn-generate-qr-code")), 5000);

    // TEST 12.1: Generación de Token QR para Proyección en Clase
    total++;
    console.log("  [Test 12.1] Generación de Token QR temporal de presentismo...");
    const btnGenerate = await driver.findElement(By.id("btn-generate-qr-code"));
    await btnGenerate.click();
    await driver.sleep(200);

    const teacherQrModal = await driver.findElement(By.id("teacher-qr-modal"));
    assert(await teacherQrModal.isDisplayed(), "El modal de proyección de QR para el Docente debe estar visible");

    const tokenText = await driver.findElement(By.id("qr-generated-token")).getText();
    assert(tokenText.length === 6, "El token generado debe tener exactamente 6 caracteres alfanuméricos");
    
    const closeQrBtn = await driver.findElement(By.css("#teacher-qr-modal button"));
    await closeQrBtn.click();
    await driver.sleep(200);
    console.log("    ✓ Pasado: Generación de Token QR de 6 caracteres comprobada.");
    passed++;

    // TEST 12.2: Programación de Envíos Masivos de Emails por Alerta Temprana
    total++;
    console.log("  [Test 12.2] Programación de automatización de correos de Alerta Temprana...");
    const btnOpenSchedule = await driver.findElement(By.id("btn-open-schedule-email-modal"));
    await btnOpenSchedule.click();
    await driver.sleep(200);

    const scheduleModal = await driver.findElement(By.id("schedule-email-modal"));
    assert(await scheduleModal.isDisplayed(), "El modal de programación de email debe estar visible");

    const submitScheduleBtn = await driver.findElement(By.id("btn-submit-schedule-email"));
    await submitScheduleBtn.click();
    await driver.sleep(200);

    const toastMsg = await driver.findElement(By.id("toast-msg")).getText();
    assert(toastMsg.includes("programado"), "Debe notificar la programación exitosa del envío masivo");
    console.log("    ✓ Pasado: Programación de envíos masivos por alerta temprana verificada.");
    passed++;

  } catch (err) {
    console.error("  ❌ FALLO en Teacher Test:", err.message);
  } finally {
    await driver.quit();
  }

  return { name: "Herramientas de Cátedra y Docencia", passed, total };
}

module.exports = runTeacherTests;
