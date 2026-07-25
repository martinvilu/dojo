const { createDriver, BASE_URL, assert, assertEqual, By, until } = require("./config");

async function runModalsTests() {
  console.log("\n🖼️ --- Ejecutando Tests Selenium: Modales e Interfaz Emergente ---");
  const driver = await createDriver();
  let passed = 0;
  let total = 0;

  try {
    await driver.get(`${BASE_URL}/dashboard`);
    await driver.wait(until.elementLocated(By.tagName("h1")), 5000);

    // TEST 2.1: Abrir Modal de Enviar Correo Directo y verificar legibilidad y min-width
    total++;
    console.log("  [Test 2.1] Abrir Modal de Enviar Correo Directo y verificar dimensiones...");
    const btnEmailJuan = await driver.findElement(By.id("btn-email-juan"));
    await btnEmailJuan.click();
    await driver.sleep(200);

    const emailModal = await driver.findElement(By.id("email-modal"));
    assert(await emailModal.isDisplayed(), "El modal de enviar correo debe estar visible");

    const emailModalCard = await driver.findElement(By.id("email-modal-card"));
    const rect = await emailModalCard.getRect();
    assert(rect.width >= 280, `El modal debe tener un ancho mínimo razonable (actual: ${rect.width}px)`);

    const subjectInput = await driver.findElement(By.id("email-subject-input"));
    const bodyTextarea = await driver.findElement(By.id("email-body-textarea"));
    assert(await subjectInput.isDisplayed(), "El campo Asunto debe estar visible");
    assert(await bodyTextarea.isDisplayed(), "El área de texto Mensaje debe estar visible");
    console.log("    ✓ Pasado: Modal de Correo Directo abierto con ancho apropiado (>=280px).");
    passed++;

    // TEST 2.2: Enviar correo desde el Modal y verificar cierre + confirmación Toast
    total++;
    console.log("  [Test 2.2] Enviar correo desde el modal y verificar cierre...");
    await subjectInput.clear();
    await subjectInput.sendKeys("Recordatorio de Asistencia Crítica");
    
    const sendBtn = await driver.findElement(By.id("btn-send-email-submit"));
    await sendBtn.click();
    await driver.sleep(200);

    const isModalVisible = await emailModal.isDisplayed();
    assert(!isModalVisible, "El modal debe cerrarse tras enviar el correo");

    const toastContainer = await driver.findElement(By.id("toast-container"));
    assert(await toastContainer.isDisplayed(), "Debe mostrar notificación Toast de éxito tras enviar");
    console.log("    ✓ Pasado: Envío de correo directo y cierre automático verificado.");
    passed++;

    // TEST 2.3: Abrir Modal de Guía LTI y verificar su contenido
    total++;
    console.log("  [Test 2.3] Abrir Modal de Guía LTI Moodle y comprobar cierre...");
    const btnOpenLti = await driver.findElement(By.id("btn-open-lti-guide"));
    await btnOpenLti.click();
    await driver.sleep(200);

    const ltiModal = await driver.findElement(By.id("lti-modal"));
    assert(await ltiModal.isDisplayed(), "El modal de guía LTI debe estar visible");

    const ltiUrlCode = await driver.findElement(By.id("lti-url-code")).getText();
    assert(ltiUrlCode.includes("/api/lti/launch"), "Debe mostrar el endpoint de launch LTI");

    const closeLtiBtn = await driver.findElement(By.id("btn-close-lti-modal"));
    await closeLtiBtn.click();
    await driver.sleep(200);

    assert(!(await ltiModal.isDisplayed()), "El modal LTI debe cerrarse al hacer clic en ✕");
    console.log("    ✓ Pasado: Modal de Guía LTI Moodle e interactividad confirmados.");
    passed++;

  } catch (err) {
    console.error("  ❌ FALLO en Modals Test:", err.message);
  } finally {
    await driver.quit();
  }

  return { name: "Modales e Interfaz Emergente", passed, total };
}

module.exports = runModalsTests;
