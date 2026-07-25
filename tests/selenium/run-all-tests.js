const runLoginTests = require("./login.test");
const runModalsTests = require("./modals.test");
const runDashboardTests = require("./dashboard.test");
const runMoodleTests = require("./moodle.test");
const runCalendarTests = require("./calendar.test");
const runToastTests = require("./toast.test");
const { startMockServer } = require("./server");

async function main() {
  console.log("==========================================================================");
  console.log("🤖 NINJA DOJO - SUITE EXTENDIDA DE TEST E2E AUTOMATIZADA CON SELENIUM 🤖");
  console.log("==========================================================================");
  
  const server = await startMockServer(3000);
  if (server) {
    console.log("  ℹ️ Servidor HTTP de prueba iniciado localmente en http://localhost:3000");
  } else {
    console.log("  ℹ️ Servidor en ejecución detectado en http://localhost:3000");
  }

  const startTime = Date.now();
  const results = [];

  try {
    results.push(await runLoginTests());
    results.push(await runModalsTests());
    results.push(await runDashboardTests());
    results.push(await runMoodleTests());
    results.push(await runCalendarTests());
    results.push(await runToastTests());
  } finally {
    if (server) {
      server.close();
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n==========================================================================");
  console.log("📊 RESUMEN EJECUTIVO DE RESULTADOS DE PRUEBAS SELENIUM");
  console.log("==========================================================================");

  let totalPassed = 0;
  let totalTests = 0;

  results.forEach(r => {
    totalPassed += r.passed;
    totalTests += r.total;
    const statusIcon = r.passed === r.total ? "✅ PASADO" : "❌ CON ERRORES";
    console.log(`  • ${r.name}: ${r.passed}/${r.total} pruebas pasadas - ${statusIcon}`);
  });

  console.log("--------------------------------------------------------------------------");
  console.log(`🎯 Total de Pruebas: ${totalPassed}/${totalTests} exitosas en ${duration}s`);
  console.log("==========================================================================\n");

  if (totalPassed < totalTests) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error("Error fatal ejecutando suite de pruebas Selenium:", err);
  process.exit(1);
});
