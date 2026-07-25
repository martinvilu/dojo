const { createDriver, BASE_URL, assert, assertEqual, By, until } = require("./config");

async function runFeaturesTests() {
  console.log("\n⚡ --- Ejecutando Tests Selenium: Feedback Anónimo, Tutorías y Cronogramas ---");
  const driver = await createDriver();
  let passed = 0;
  let total = 0;

  try {
    await driver.get(`${BASE_URL}/dashboard`);
    await driver.wait(until.elementLocated(By.id("btn-open-feedback-modal")), 5000);

    // TEST 8.1: Encuesta de Feedback Anónimo de Clases
    total++;
    console.log("  [Test 8.1] Formulario de Feedback Anónimo y valoración con estrellas...");
    const btnFeedback = await driver.findElement(By.id("btn-open-feedback-modal"));
    await btnFeedback.click();
    await driver.sleep(200);

    const feedbackModal = await driver.findElement(By.id("feedback-modal"));
    assert(await feedbackModal.isDisplayed(), "Modal de feedback debe mostrarse");

    const commentInput = await driver.findElement(By.id("feedback-comment-input"));
    await commentInput.sendKeys("Excelente dinámica de la clase práctica.");

    const submitFeedbackBtn = await driver.findElement(By.id("btn-submit-feedback"));
    await submitFeedbackBtn.click();
    await driver.sleep(200);

    let toastMsg = await driver.findElement(By.id("toast-msg")).getText();
    assert(toastMsg.includes("Feedback anónimo enviado"), "Debe notificar el envío del feedback anónimo");
    
    // Dismiss toast to prevent intercepting lower screen buttons
    const closeToastBtn = await driver.findElement(By.id("btn-close-toast"));
    await closeToastBtn.click();
    await driver.sleep(200);

    console.log("    ✓ Pasado: Feedback anónimo registrado exitosamente.");
    passed++;

    // TEST 8.2: Registro y Postulación como Tutor Académico
    total++;
    console.log("  [Test 8.2] Postulación como Tutor Académico y disponibilidad horaria...");
    const btnTutor = await driver.findElement(By.id("btn-open-tutoring-modal"));
    await btnTutor.click();
    await driver.sleep(200);

    const tutorTopics = await driver.findElement(By.id("tutor-topics-input"));
    const tutorAvail = await driver.findElement(By.id("tutor-avail-input"));
    await tutorTopics.sendKeys("React, Node.js, TypeScript");
    await tutorAvail.sendKeys("Lunes 18:00 a 20:00 hs");

    const submitTutorBtn = await driver.findElement(By.id("btn-submit-tutor"));
    await submitTutorBtn.click();
    await driver.sleep(200);

    toastMsg = await driver.findElement(By.id("toast-msg")).getText();
    assert(toastMsg.includes("tutor registrada"), "Debe confirmar la postulación de tutoría");

    // Dismiss toast
    await closeToastBtn.click();
    await driver.sleep(200);

    console.log("    ✓ Pasado: Postulación de tutoría académica comprobada.");
    passed++;

    // TEST 8.3: Guardar Snapshot de Versión del Cronograma
    total++;
    console.log("  [Test 8.3] Creación de Snapshot de Versión del Cronograma...");
    const btnVersion = await driver.findElement(By.id("btn-open-version-modal"));
    await btnVersion.click();
    await driver.sleep(200);

    const versionNameInput = await driver.findElement(By.id("version-name-input"));
    await versionNameInput.sendKeys("Planificación Final Julio 2026");

    const saveVersionBtn = await driver.findElement(By.id("btn-save-version"));
    await saveVersionBtn.click();
    await driver.sleep(200);

    toastMsg = await driver.findElement(By.id("toast-msg")).getText();
    assert(toastMsg.includes("versión guardado"), "Debe notificar la creación del snapshot de versión");
    console.log("    ✓ Pasado: Snapshot de versión de cronograma guardado exitosamente.");
    passed++;

  } catch (err) {
    console.error("  ❌ FALLO en Features Test:", err.message);
  } finally {
    await driver.quit();
  }

  return { name: "Feedback, Tutorías y Cronogramas", passed, total };
}

module.exports = runFeaturesTests;
