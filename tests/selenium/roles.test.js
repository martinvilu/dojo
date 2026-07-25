const { createDriver, BASE_URL, assert, assertEqual, By, until } = require("./config");

async function runRolesTests() {
  console.log("\n👥 --- Ejecutando Tests Selenium: Verificación Exhaustiva de Roles de Usuario (Estudiante, Tutor, Docente, Admin) ---");
  const driver = await createDriver();
  let passed = 0;
  let total = 0;

  try {
    await driver.get(`${BASE_URL}/dashboard`);
    await driver.wait(until.elementLocated(By.id("user-role-selector")), 5000);
    const roleSelect = await driver.findElement(By.id("user-role-selector"));

    // ==========================================
    // 🎓 SECCIÓN 1: ROL ESTUDIANTE
    // ==========================================
    
    // TEST 11.1: Rol Estudiante - Conmutación y Badge de Interfaz
    total++;
    console.log("  [Test 11.1] Conmutación al Rol Estudiante y actualización de interfaz...");
    await roleSelect.findElement(By.css("option[value='Estudiante']")).click();
    await driver.sleep(200);

    let badgeText = await driver.findElement(By.id("current-role-badge")).getText();
    assertEqual(badgeText.toUpperCase(), "ESTUDIANTE", "El badge de la interfaz debe actualizarse a Estudiante");

    let toastMsg = await driver.findElement(By.id("toast-msg")).getText();
    assert(toastMsg.includes("Rol cambiado a: Estudiante"), "Debe notificar el cambio de rol en la interfaz");
    console.log("    ✓ Pasado: Rol Estudiante activado correctamente.");
    passed++;

    // TEST 11.2: Rol Estudiante - Firma de Asistencia y GitHub
    total++;
    console.log("  [Test 11.2] Acceso del Estudiante a Firma Presente QR...");
    const btnQr = await driver.findElement(By.id("btn-open-qr-modal"));
    await btnQr.click();
    await driver.sleep(200);

    const qrModal = await driver.findElement(By.id("qr-modal"));
    assert(await qrModal.isDisplayed(), "El modal de QR debe estar disponible para el Estudiante");

    const cancelQrBtn = await driver.findElement(By.css("#qr-modal button"));
    await cancelQrBtn.click();
    await driver.sleep(200);
    console.log("    ✓ Pasado: Acceso de Estudiante a módulos académicos comprobado.");
    passed++;

    // ==========================================
    // 🤝 SECCIÓN 2: ROL TUTOR ACADÉMICO
    // ==========================================

    // TEST 11.3: Rol Tutor Académico - Conmutación y Panel
    total++;
    console.log("  [Test 11.3] Conmutación al Rol Tutor Académico...");
    await roleSelect.findElement(By.css("option[value='Tutor']")).click();
    await driver.sleep(200);

    badgeText = await driver.findElement(By.id("current-role-badge")).getText();
    assert(badgeText.toUpperCase().includes("TUTOR"), "El badge debe actualizarse a Tutor");
    console.log("    ✓ Pasado: Rol Tutor Académico activado.");
    passed++;

    // TEST 11.4: Rol Tutor Académico - Aceptar Sesión de Tutoría
    total++;
    console.log("  [Test 11.4] Gestión de solicitudes de tutoría entre pares...");
    const btnTutorDash = await driver.findElement(By.id("btn-open-tutor-dashboard"));
    await btnTutorDash.click();
    await driver.sleep(200);

    const tutorModal = await driver.findElement(By.id("tutor-dashboard-modal"));
    assert(await tutorModal.isDisplayed(), "El panel de tutor debe ser accesible");

    const acceptBtn = await driver.findElement(By.id("btn-accept-session-1"));
    await acceptBtn.click();
    await driver.sleep(200);

    toastMsg = await driver.findElement(By.id("toast-msg")).getText();
    assert(toastMsg.includes("tutoría aceptada"), "Debe notificar la aceptación de la sesión de tutoría");
    console.log("    ✓ Pasado: Aceptación de sesión de tutoría verificada.");
    passed++;

    // ==========================================
    // 👨‍🏫 SECCIÓN 3: ROL DOCENTE
    // ==========================================

    // TEST 11.5: Rol Docente - Conmutación y Alertas Tempranas
    total++;
    console.log("  [Test 11.5] Conmutación al Rol Docente y revisión de Alertas Tempranas...");
    await roleSelect.findElement(By.css("option[value='Docente']")).click();
    await driver.sleep(200);

    badgeText = await driver.findElement(By.id("current-role-badge")).getText();
    assertEqual(badgeText.toUpperCase(), "DOCENTE", "El badge debe actualizarse a Docente");

    const criticalBadge = await driver.findElement(By.id("alert-badge-critical"));
    assert(await criticalBadge.isDisplayed(), "El Docente debe ver las alertas críticas de asistencia (<75%)");
    console.log("    ✓ Pasado: Herramientas de Cátedra y Alertas del Docente verificadas.");
    passed++;

    // TEST 11.6: Rol Docente - Envío de Correo Directo a Estudiantes en Riesgo
    total++;
    console.log("  [Test 11.6] Envío de Correo Directo desde la lista de Cátedra...");
    const btnEmailJuan = await driver.findElement(By.id("btn-email-juan"));
    await btnEmailJuan.click();
    await driver.sleep(200);

    const emailModal = await driver.findElement(By.id("email-modal"));
    assert(await emailModal.isDisplayed(), "El modal de correo directo debe ser accesible para el Docente");

    const btnCloseEmail = await driver.findElement(By.id("btn-close-email-modal"));
    await btnCloseEmail.click();
    await driver.sleep(200);
    console.log("    ✓ Pasado: Gestión de comunicaciones del Docente comprobada.");
    passed++;

    // ==========================================
    // ⚙️ SECCIÓN 4: ROL ADMINISTRADOR
    // ==========================================

    // TEST 11.7: Rol Administrador - Conmutación y Gestión de Usuarios
    total++;
    console.log("  [Test 11.7] Conmutación al Rol Administrador y gestión de usuarios...");
    await roleSelect.findElement(By.css("option[value='Administrador']")).click();
    await driver.sleep(200);

    badgeText = await driver.findElement(By.id("current-role-badge")).getText();
    assertEqual(badgeText.toUpperCase(), "ADMINISTRADOR", "El badge debe actualizarse a Administrador");
    console.log("    ✓ Pasado: Rol Administrador activado.");
    passed++;

    // TEST 11.8: Rol Administrador - Guía e Integración Moodle LTI 1.3
    total++;
    console.log("  [Test 11.8] Acceso a Configuración LTI 1.3 Moodle y respaldos...");
    const btnLtiGuide = await driver.findElement(By.id("btn-open-lti-guide"));
    await btnLtiGuide.click();
    await driver.sleep(200);

    const ltiModal = await driver.findElement(By.id("lti-modal"));
    assert(await ltiModal.isDisplayed(), "La guía LTI debe estar disponible para la administración");

    const btnCloseLti = await driver.findElement(By.id("btn-close-lti-modal"));
    await btnCloseLti.click();
    await driver.sleep(200);
    console.log("    ✓ Pasado: Herramientas de Integración y Administración verificadas.");
    passed++;

  } catch (err) {
    console.error("  ❌ FALLO en Roles Test:", err.message);
  } finally {
    await driver.quit();
  }

  return { name: "Verificación Exhaustiva de Roles de Usuario", passed, total };
}

module.exports = runRolesTests;
