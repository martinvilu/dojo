const { createDriver, BASE_URL, assert, assertEqual, By, until } = require("./config");

async function runRolesTests() {
  console.log("\n👥 --- Ejecutando Tests Selenium: Verificación de Roles de Usuario (Estudiante, Tutor, Docente, Admin) ---");
  const driver = await createDriver();
  let passed = 0;
  let total = 0;

  try {
    await driver.get(`${BASE_URL}/dashboard`);
    await driver.wait(until.elementLocated(By.id("user-role-selector")), 5000);

    // TEST 11.1: Rol Estudiante - Cambio de Rol y Permisos de Interfaz
    total++;
    console.log("  [Test 11.1] Verificación de cambiar rol activo a Estudiante...");
    const roleSelect = await driver.findElement(By.id("user-role-selector"));
    await roleSelect.findElement(By.css("option[value='Estudiante']")).click();
    await driver.sleep(200);

    let badgeText = await driver.findElement(By.id("current-role-badge")).getText();
    assertEqual(badgeText.toUpperCase(), "ESTUDIANTE", "El badge de la interfaz debe actualizarse a Estudiante");

    let toastMsg = await driver.findElement(By.id("toast-msg")).getText();
    assert(toastMsg.includes("Rol cambiado a: Estudiante"), "Debe notificar el cambio de rol en la interfaz");
    console.log("    ✓ Pasado: Rol de Estudiante activado y notificado.");
    passed++;

    // TEST 11.2: Rol Tutor Académico - Aceptar Sesión de Tutoría entre Pares
    total++;
    console.log("  [Test 11.2] Verificación del Rol Tutor Académico y gestión de sesiones...");
    await roleSelect.findElement(By.css("option[value='Tutor']")).click();
    await driver.sleep(200);

    badgeText = await driver.findElement(By.id("current-role-badge")).getText();
    assert(badgeText.toUpperCase().includes("TUTOR"), "El badge de la interfaz debe actualizarse a Tutor");

    const btnTutorDash = await driver.findElement(By.id("btn-open-tutor-dashboard"));
    await btnTutorDash.click();
    await driver.sleep(200);

    const tutorModal = await driver.findElement(By.id("tutor-dashboard-modal"));
    assert(await tutorModal.isDisplayed(), "El panel de tutor académico debe estar visible");

    const acceptBtn = await driver.findElement(By.id("btn-accept-session-1"));
    await acceptBtn.click();
    await driver.sleep(200);

    toastMsg = await driver.findElement(By.id("toast-msg")).getText();
    assert(toastMsg.includes("tutoría aceptada"), "Debe notificar que la sesión de tutoría fue aceptada");
    console.log("    ✓ Pasado: Rol de Tutor Académico comprobado.");
    passed++;

    // TEST 11.3: Rol Docente - Acceso a Herramientas de Cátedra
    total++;
    console.log("  [Test 11.3] Verificación del Rol Docente y herramientas de cátedra...");
    await roleSelect.findElement(By.css("option[value='Docente']")).click();
    await driver.sleep(200);

    badgeText = await driver.findElement(By.id("current-role-badge")).getText();
    assertEqual(badgeText.toUpperCase(), "DOCENTE", "El badge de la interfaz debe actualizarse a Docente");
    console.log("    ✓ Pasado: Rol de Docente comprobado.");
    passed++;

    // TEST 11.4: Rol Administrador - Privilegios de Administración del Sistema
    total++;
    console.log("  [Test 11.4] Verificación del Rol Administrador...");
    await roleSelect.findElement(By.css("option[value='Administrador']")).click();
    await driver.sleep(200);

    badgeText = await driver.findElement(By.id("current-role-badge")).getText();
    assertEqual(badgeText.toUpperCase(), "ADMINISTRADOR", "El badge de la interfaz debe actualizarse a Administrador");
    console.log("    ✓ Pasado: Rol de Administrador comprobado.");
    passed++;

  } catch (err) {
    console.error("  ❌ FALLO en Roles Test:", err.message);
  } finally {
    await driver.quit();
  }

  return { name: "Verificación de Roles de Usuario", passed, total };
}

module.exports = runRolesTests;
