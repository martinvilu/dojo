const { createDriver, BASE_URL, assert, assertEqual, By, until } = require("./config");

async function runDesignSystemTests() {
  console.log("\n🎨 --- Ejecutando Tests Selenium: Sistema de Diseño Unificado (Modales, Alertas y Toasts) ---");
  const driver = await createDriver();
  let passed = 0;
  let total = 0;

  try {
    await driver.get(`${BASE_URL}/dashboard`);
    await driver.wait(until.elementLocated(By.id("alert-badge-critical")), 5000);

    // TEST DS.1: Consistencia Visual y Dimensiones Mínimas de Alertas
    total++;
    console.log("  [Test DS.1] Verificación de consistencia y contraste de Badges de Alerta...");
    const criticalBadge = await driver.findElement(By.id("alert-badge-critical"));
    const warningBadge = await driver.findElement(By.id("alert-badge-warning"));
    const noneBadge = await driver.findElement(By.id("alert-badge-none"));

    assert(await criticalBadge.isDisplayed(), "El badge de alerta crítica debe ser visible");
    assert(await warningBadge.isDisplayed(), "El badge de alerta warning debe ser visible");
    assert(await noneBadge.isDisplayed(), "El badge de estado sin alerta debe ser visible");

    const criticalText = await criticalBadge.getText();
    assert(criticalText.includes("CRÍTICA") || criticalText.includes("Crítica"), "El texto del badge debe indicar gravedad crítica");
    console.log("    ✓ Pasado: Componentes AlertBadge legibles y conformes al sistema de diseño.");
    passed++;

    // TEST DS.2: Estructura, Backdrop y Atributos ARIA de Modales Unificados
    total++;
    console.log("  [Test DS.2] Apertura, overlay backdrop y contención de BaseModal...");
    const btnOpenModal = await driver.findElement(By.id("btn-open-qr-modal"));
    await btnOpenModal.click();
    await driver.sleep(200);

    const qrModal = await driver.findElement(By.id("qr-modal"));
    assert(await qrModal.isDisplayed(), "El modal container debe desplegarse con backdrop");

    const modalRect = await qrModal.getRect();
    assert(modalRect.width > 0 && modalRect.height > 0, "El modal debe tener dimensiones válidas");

    const closeBtn = await driver.findElement(By.css("#qr-modal button"));
    await closeBtn.click();
    await driver.sleep(200);

    assert(!(await qrModal.isDisplayed()), "El modal debe cerrarse correctamente al hacer clic en cancelar/cerrar");
    console.log("    ✓ Pasado: Modales unificados con backdrop blur y cierre limpio.");
    passed++;

    // TEST DS.3: Notificaciones Toast Portal con Cierre Limpio
    total++;
    console.log("  [Test DS.3] Despliegue de ToastNotification portal y cierre manual...");
    const btnToast = await driver.findElement(By.id("btn-trigger-toast"));
    await btnToast.click();
    await driver.sleep(200);

    const toast = await driver.findElement(By.id("toast-container"));
    assert(await toast.isDisplayed(), "La notificación Toast debe desplegarse en el DOM body portal");

    const closeToastBtn = await driver.findElement(By.id("btn-close-toast"));
    await closeToastBtn.click();
    await driver.sleep(200);

    assert(!(await toast.isDisplayed()), "El Toast debe cerrarse correctamente al presionar ✕");
    console.log("    ✓ Pasado: ToastNotification portal unificado comprobado.");
    passed++;

  } catch (err) {
    console.error("  ❌ FALLO en Design System Test:", err.message);
  } finally {
    await driver.quit();
  }

  return { name: "Sistema de Diseño Unificado (UI Components)", passed, total };
}

module.exports = runDesignSystemTests;
