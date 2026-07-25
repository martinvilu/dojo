const { createDriver, BASE_URL, assert, assertEqual, By, until } = require("./config");

async function runTutorTests() {
  console.log("\n🤝 --- Ejecutando Tests Selenium: Flujos Específicos del Rol Tutor Académico ---");
  const driver = await createDriver();
  let passed = 0;
  let total = 0;

  try {
    await driver.get(`${BASE_URL}/dashboard`);
    await driver.wait(until.elementLocated(By.id("btn-open-tutor-profile-modal")), 5000);

    // TEST 13.1: Configuración de Materias Habilitadas y Perfil del Tutor
    total++;
    console.log("  [Test 13.1] Ajustes de materias habilitadas y disponibilidad del Tutor...");
    const btnProfile = await driver.findElement(By.id("btn-open-tutor-profile-modal"));
    await btnProfile.click();
    await driver.sleep(200);

    const profileModal = await driver.findElement(By.id("tutor-profile-modal"));
    assert(await profileModal.isDisplayed(), "El modal de perfil del tutor debe estar visible");

    const subjectsInput = await driver.findElement(By.id("tutor-subjects-input"));
    await subjectsInput.clear();
    await subjectsInput.sendKeys("Programación I, Algoritmos, React Hooks");

    const saveBtn = await driver.findElement(By.id("btn-save-tutor-profile"));
    await saveBtn.click();
    await driver.sleep(200);

    let toastMsg = await driver.findElement(By.id("toast-msg")).getText();
    assert(toastMsg.includes("Perfil de tutor actualizado"), "Debe confirmar la actualización del perfil del tutor");
    console.log("    ✓ Pasado: Configuración de materias habilitadas del tutor verificada.");
    passed++;

    // TEST 13.2: Rechazo o Reprogramación de Solicitud de Tutoría
    total++;
    console.log("  [Test 13.2] Rechazar o solicitar reprogramación de sesión de tutoría...");
    const btnTutorDash = await driver.findElement(By.id("btn-open-tutor-dashboard"));
    await btnTutorDash.click();
    await driver.sleep(200);

    const tutorModal = await driver.findElement(By.id("tutor-dashboard-modal"));
    assert(await tutorModal.isDisplayed(), "El modal de panel de tutor debe estar visible");

    const declineBtn = await driver.findElement(By.id("btn-decline-session-1"));
    await declineBtn.click();
    await driver.sleep(200);

    toastMsg = await driver.findElement(By.id("toast-msg")).getText();
    assert(toastMsg.includes("rechazada o reprogramada"), "Debe notificar el rechazo o reprogramación de la tutoría");
    console.log("    ✓ Pasado: Rechazo/reprogramación de tutoría verificado.");
    passed++;

  } catch (err) {
    console.error("  ❌ FALLO en Tutor Test:", err.message);
  } finally {
    await driver.quit();
  }

  return { name: "Gestión de Mentorías y Tutor Académico", passed, total };
}

module.exports = runTutorTests;
