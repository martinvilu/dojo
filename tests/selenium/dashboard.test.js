const { createDriver, BASE_URL, assert, assertEqual, By, until } = require("./config");

async function runDashboardTests() {
  console.log("\n📊 --- Ejecutando Tests Selenium: Dashboard, Alertas Tempranas y Exportación CSV ---");
  const driver = await createDriver();
  let passed = 0;
  let total = 0;

  try {
    await driver.get(`${BASE_URL}/dashboard`);
    await driver.wait(until.elementLocated(By.id("roster-table")), 5000);

    // TEST 3.1: Verificar legibilidad y estilos de Badges de Alertas Tempranas
    total++;
    console.log("  [Test 3.1] Verificar legibilidad y dimensiones de Badges de Alertas Tempranas...");
    const criticalBadge = await driver.findElement(By.id("alert-badge-critical"));
    const warningBadge = await driver.findElement(By.id("alert-badge-warning"));
    const noneBadge = await driver.findElement(By.id("alert-badge-none"));

    assert(await criticalBadge.isDisplayed(), "Badge Asistencia Crítica debe estar visible");
    assert(await warningBadge.isDisplayed(), "Badge Tareas Atrasadas debe estar visible");
    assert(await noneBadge.isDisplayed(), "Badge Sin Alertas debe estar visible");

    const criticalText = await criticalBadge.getAttribute("textContent");
    assert(criticalText.includes("Asistencia") && criticalText.includes("Crítica"), "Debe mostrar el texto de Asistencia Crítica");

    const warningText = await warningBadge.getAttribute("textContent");
    assert(warningText.includes("Tareas Atrasadas"), "Debe mostrar el texto de Tareas Atrasadas");
    console.log("    ✓ Pasado: Badges de Alertas Tempranas legibles y verificados.");
    passed++;

    // TEST 3.2: Verificar sección desplegable oculta de URL de Endpoint CSV
    total++;
    console.log("  [Test 3.2] Verificar sección desplegable oculta para URL de Endpoint CSV...");
    const csvSection = await driver.findElement(By.id("csv-endpoint-section"));
    const csvInput = await driver.findElement(By.id("csv-url-input"));

    let isInputDisplayed = await csvInput.isDisplayed();
    assert(!isInputDisplayed, "La URL del Endpoint CSV debe estar oculta por defecto dentro de details");

    const summaryToggle = await driver.findElement(By.id("csv-section-summary"));
    await summaryToggle.click();
    await driver.sleep(200);

    isInputDisplayed = await csvInput.isDisplayed();
    assert(isInputDisplayed, "La URL del Endpoint CSV debe ser visible al desplegar la sección");

    const csvUrlVal = await csvInput.getAttribute("value");
    assert(csvUrlVal.includes("/api/csv-export"), "Debe contener la ruta de exportación CSV");
    console.log("    ✓ Pasado: Sección desplegable oculta de URL CSV comprobada.");
    passed++;

  } catch (err) {
    console.error("  ❌ FALLO en Dashboard Test:", err.message);
  } finally {
    await driver.quit();
  }

  return { name: "Dashboard, Alertas Tempranas y CSV", passed, total };
}

module.exports = runDashboardTests;
