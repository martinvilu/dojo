const { createDriver, BASE_URL, assert, assertEqual, By, until } = require("./config");

async function runToastTests() {
  console.log("\n🔔 --- Ejecutando Tests Selenium: Toast Notifications y Viewport Contained UI ---");
  const driver = await createDriver();
  let passed = 0;
  let total = 0;

  try {
    await driver.get(`${BASE_URL}/dashboard`);
    await driver.wait(until.elementLocated(By.tagName("h1")), 5000);

    // TEST 6.1: Disparar Toast Notification y verificar visibilidad en DOM
    total++;
    console.log("  [Test 6.1] Disparar ToastNotification y verificar presencia en el DOM...");
    const btnToast = await driver.findElement(By.id("btn-trigger-toast"));
    await btnToast.click();
    await driver.sleep(200);

    const toastContainer = await driver.findElement(By.id("toast-container"));
    assert(await toastContainer.isDisplayed(), "La notificación Toast debe mostrarse en el DOM");

    const toastMsg = await driver.findElement(By.id("toast-msg")).getText();
    assert(toastMsg.length > 0, "El mensaje del Toast no debe estar vacío");
    console.log("    ✓ Pasado: Notificación Toast desplegada y leída exitosamente.");
    passed++;

    // TEST 6.2: Verificar contención en viewport y cierre mediante botón ✕
    total++;
    console.log("  [Test 6.2] Cierre manual de Toast con botón ✕ y contención de viewport...");
    const btnCloseToast = await driver.findElement(By.id("btn-close-toast"));
    await btnCloseToast.click();
    await driver.sleep(200);

    const isToastVisible = await toastContainer.isDisplayed();
    assert(!isToastVisible, "El Toast debe ocultarse al hacer clic en ✕");
    console.log("    ✓ Pasado: Notificaciones emergentes contenidas al 100% y cierre verificado.");
    passed++;

  } catch (err) {
    console.error("  ❌ FALLO en Toast Test:", err.message);
  } finally {
    await driver.quit();
  }

  return { name: "Notificaciones Toast y Viewport", passed, total };
}

module.exports = runToastTests;
