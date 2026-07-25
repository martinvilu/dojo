const { createDriver, BASE_URL, assert, assertEqual, By, until } = require("./config");

async function runAdminTests() {
  console.log("\n⚙️ --- Ejecutando Tests Selenium: Panel de Administración y Grupos de Estudio ---");
  const driver = await createDriver();
  let passed = 0;
  let total = 0;

  try {
    await driver.get(`${BASE_URL}/dashboard`);
    await driver.wait(until.elementLocated(By.id("btn-delete-juan")), 5000);

    // TEST 9.1: Modal de Advertencia y Confirmación para Borrar Usuario
    total++;
    console.log("  [Test 9.1] Modal de advertencia y confirmación para borrar usuario...");
    const btnDelete = await driver.findElement(By.id("btn-delete-juan"));
    await btnDelete.click();
    await driver.sleep(200);

    const deleteModal = await driver.findElement(By.id("delete-user-modal"));
    assert(await deleteModal.isDisplayed(), "El modal de borrado de usuario debe estar visible");

    const deleteTitle = await driver.findElement(By.id("delete-user-title")).getText();
    assert(deleteTitle.includes("Borrar Usuario"), "El título del modal debe contener la advertencia de seguridad");

    const confirmDeleteBtn = await driver.findElement(By.id("btn-confirm-delete"));
    await confirmDeleteBtn.click();
    await driver.sleep(200);

    let toastMsg = await driver.findElement(By.id("toast-msg")).getText();
    assert(toastMsg.includes("eliminado correctamente"), "Debe notificar la eliminación del usuario");
    console.log("    ✓ Pasado: Eliminación de usuario y confirmación de seguridad comprobadas.");
    passed++;

    // TEST 9.2: Creación de Grupo de Estudio y Selección de Preferencia Horaria
    total++;
    console.log("  [Test 9.2] Creación de Grupo de Estudio y selección de preferencia horaria...");
    const btnOpenGroup = await driver.findElement(By.id("btn-open-group-modal"));
    await btnOpenGroup.click();
    await driver.sleep(200);

    const groupModal = await driver.findElement(By.id("group-modal"));
    assert(await groupModal.isDisplayed(), "El modal de creación de grupo debe estar visible");

    const groupNameInput = await driver.findElement(By.id("group-name-input"));
    await groupNameInput.sendKeys("Grupo Algoritmos Avanzados");

    const scheduleSelect = await driver.findElement(By.id("group-schedule-select"));
    await scheduleSelect.findElement(By.css("option[value='Noche']")).click();

    const submitGroupBtn = await driver.findElement(By.id("btn-submit-group"));
    await submitGroupBtn.click();
    await driver.sleep(200);

    toastMsg = await driver.findElement(By.id("toast-msg")).getText();
    assert(toastMsg.includes("Grupo de estudio creado"), "Debe notificar la creación del grupo de estudio");
    console.log("    ✓ Pasado: Creación de grupo de estudio y preferencia horaria verificadas.");
    passed++;

    // TEST 9.3: Asignación Masiva de Comisiones por el Administrador
    total++;
    console.log("  [Test 9.3] Asignación masiva de comisiones por el Administrador...");
    const btnBulkCommission = await driver.findElement(By.id("btn-open-bulk-commission-modal"));
    await btnBulkCommission.click();
    await driver.sleep(200);

    const bulkModal = await driver.findElement(By.id("bulk-commission-modal"));
    assert(await bulkModal.isDisplayed(), "Modal de asignación masiva de comisiones debe estar visible");

    const submitBulkBtn = await driver.findElement(By.id("btn-submit-bulk-commission"));
    await submitBulkBtn.click();
    await driver.sleep(200);

    toastMsg = await driver.findElement(By.id("toast-msg")).getText();
    assert(toastMsg.includes("Comisiones asignadas masivamente"), "Debe notificar la asignación masiva de comisiones");
    console.log("    ✓ Pasado: Asignación masiva de comisiones por el Administrador verificada.");
    passed++;

  } catch (err) {
    console.error("  ❌ FALLO en Admin Test:", err.message);
  } finally {
    await driver.quit();
  }

  return { name: "Administración y Grupos de Estudio", passed, total };
}

module.exports = runAdminTests;
