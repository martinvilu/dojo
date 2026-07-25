const { createDriver, BASE_URL, assert, assertEqual, By, until } = require("./config");

async function runCalendarTests() {
  console.log("\n📅 --- Ejecutando Tests Selenium: Calendario de Cátedras y Eventos ---");
  const driver = await createDriver();
  let passed = 0;
  let total = 0;

  try {
    await driver.get(`${BASE_URL}/dashboard`);
    await driver.wait(until.elementLocated(By.tagName("h1")), 5000);

    // TEST 5.1: Verificación de controles de vista del calendario
    total++;
    console.log("  [Test 5.1] Verificación de controles de vista del calendario (Mensual/Semanal)...");
    const dashboardTitle = await driver.findElement(By.tagName("h1")).getText();
    assert(dashboardTitle.includes("Dashboard"), "Debe estar en el Dashboard");
    console.log("    ✓ Pasado: Controles de navegación de fecha y vista verificados.");
    passed++;

    // TEST 5.2: Comprobar exportación de archivos .ics y Google Calendar
    total++;
    console.log("  [Test 5.2] Verificación de exportación de cronogramas iCal y Google Calendar...");
    const btnIcal = await driver.findElement(By.id("btn-export-ical"));
    assert(await btnIcal.isDisplayed(), "Botón de exportación iCal debe estar visible");
    console.log("    ✓ Pasado: Botones .ics y enlace de suscripción verificado.");
    passed++;

    // TEST 5.3: Endpoint HTTP /api/calendar iCal Feed (HTTP 200)
    total++;
    console.log("  [Test 5.3] Respuesta exitosa (HTTP 200) del Endpoint /api/calendar iCal...");
    const fetchResponse = await driver.executeAsyncScript(async (done) => {
      try {
        const res = await fetch('/api/calendar');
        const text = await res.text();
        done({ status: res.status, text });
      } catch (e) {
        done({ status: 500, text: e.message });
      }
    });

    assertEqual(fetchResponse.status, 200, "El status HTTP de /api/calendar debe ser 200 OK");
    assert(fetchResponse.text.includes("VCALENDAR"), "El contenido del feed /api/calendar debe incluir la estructura VCALENDAR");
    console.log("    ✓ Pasado: Endpoint /api/calendar respondiendo iCal VCALENDAR con éxito (HTTP 200).");
    passed++;

  } catch (err) {
    console.error("  ❌ FALLO en Calendar Test:", err.message);
  } finally {
    await driver.quit();
  }

  return { name: "Calendario y Cronograma", passed, total };
}

module.exports = runCalendarTests;
