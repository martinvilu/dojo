const { createDriver, BASE_URL, assert, assertEqual, By, until } = require("./config");

async function runStudentTests() {
  console.log("\n🎓 --- Ejecutando Tests Selenium: Flujos y Funcionalidades del Alumno / Usuario ---");
  const driver = await createDriver();
  let passed = 0;
  let total = 0;

  try {
    await driver.get(`${BASE_URL}/dashboard`);
    await driver.wait(until.elementLocated(By.id("btn-open-github-modal")), 5000);

    // TEST 10.1: Vinculación de Cuenta de GitHub para Sincronización de Tareas
    total++;
    console.log("  [Test 10.1] Vincular cuenta de GitHub del estudiante...");
    const btnGithub = await driver.findElement(By.id("btn-open-github-modal"));
    await btnGithub.click();
    await driver.sleep(200);

    const githubModal = await driver.findElement(By.id("github-modal"));
    assert(await githubModal.isDisplayed(), "El modal de GitHub debe estar visible");

    const githubInput = await driver.findElement(By.id("github-username-input"));
    await githubInput.sendKeys("estudiante-ninja-unrn");

    const submitGithubBtn = await driver.findElement(By.id("btn-submit-github"));
    await submitGithubBtn.click();
    await driver.sleep(200);

    let toastMsg = await driver.findElement(By.id("toast-msg")).getText();
    assert(toastMsg.includes("GitHub vinculada"), "Debe notificar la vinculación exitosa de GitHub");
    console.log("    ✓ Pasado: Vinculación de cuenta de GitHub comprobada.");
    passed++;

    // TEST 10.2: Asignación de Nombre de Equipo para Entregas Grupales
    total++;
    console.log("  [Test 10.2] Asignar nombre de equipo para entregas grupales...");
    const btnTeam = await driver.findElement(By.id("btn-open-team-modal"));
    await btnTeam.click();
    await driver.sleep(200);

    const teamModal = await driver.findElement(By.id("team-modal"));
    assert(await teamModal.isDisplayed(), "El modal de equipo debe estar visible");

    const teamInput = await driver.findElement(By.id("team-name-input"));
    await teamInput.sendKeys("EquipoNinja2026");

    const submitTeamBtn = await driver.findElement(By.id("btn-submit-team"));
    await submitTeamBtn.click();
    await driver.sleep(200);

    toastMsg = await driver.findElement(By.id("toast-msg")).getText();
    assert(toastMsg.includes("equipo asignado"), "Debe notificar la asignación del equipo a la entrega");
    console.log("    ✓ Pasado: Asignación de equipo en tareas grupales comprobada.");
    passed++;

    // TEST 10.3: Envío de Entrega con Comentario Opcional al Profesor
    total++;
    console.log("  [Test 10.3] Enviar entrega con comentario opcional para el docente...");
    const btnComment = await driver.findElement(By.id("btn-open-comment-modal"));
    await btnComment.click();
    await driver.sleep(200);

    const commentModal = await driver.findElement(By.id("comment-modal"));
    assert(await commentModal.isDisplayed(), "El modal de comentario debe estar visible");

    const commentInput = await driver.findElement(By.id("submission-comment-input"));
    await commentInput.sendKeys("Se adjuntan los tests unitarios y la documentación en el repositorio.");

    const submitCommentBtn = await driver.findElement(By.id("btn-submit-comment"));
    await submitCommentBtn.click();
    await driver.sleep(200);

    toastMsg = await driver.findElement(By.id("toast-msg")).getText();
    assert(toastMsg.includes("Entrega y comentarios enviados"), "Debe confirmar el envío de la entrega con comentarios");
    console.log("    ✓ Pasado: Envío de entrega con comentarios para el docente verificado.");
    passed++;

    // TEST 10.4: Filtro de Estudiantes por Comisión
    total++;
    console.log("  [Test 10.4] Filtrado interactivo por Comisión...");
    const filterSelect = await driver.findElement(By.id("commission-filter-select"));
    await filterSelect.sendKeys("Comisión 1");
    await driver.sleep(200);

    const row1 = await driver.findElement(By.id("student-row-1"));
    const row2 = await driver.findElement(By.id("student-row-2"));
    assert(await row1.isDisplayed(), "La fila de Comisión 1 debe ser visible");
    assert(!(await row2.isDisplayed()), "La fila de Comisión 2 debe ser ocultada al filtrar");
    console.log("    ✓ Pasado: Filtro interactivo por Comisión comprobado.");
    passed++;

    // TEST 10.5: Indicadores Visuales de Asistencia y Progreso de Tareas del Alumno
    total++;
    console.log("  [Test 10.5] Indicadores de porcentaje de Asistencia y Barra de Progreso...");
    const attPct = await driver.findElement(By.id("attendance-pct-1")).getText();
    assert(attPct.includes("65%"), "El porcentaje de asistencia debe reflejar la métrica del estudiante");

    const bar = await driver.findElement(By.id("assignments-bar-1"));
    assert(await bar.isDisplayed(), "La barra de progreso de tareas entregadas debe estar visible");
    console.log("    ✓ Pasado: Visualización de métricas de progreso académico del estudiante verificadas.");
    passed++;

  } catch (err) {
    console.error("  ❌ FALLO en Student Test:", err.message);
  } finally {
    await driver.quit();
  }

  return { name: "Funcionalidades del Alumno / Usuario", passed, total };
}

module.exports = runStudentTests;
