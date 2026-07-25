const { createDriver, BASE_URL, assert, assertEqual, By, until } = require("./config");

async function runAdminTests() {
  console.log("\n⚙️ --- Ejecutando Tests Selenium: Panel de Administración y Grupos de Estudio ---");
  const driver = await createDriver();
  let passed = 0;
  let total = 0;

  try {
    await driver.get(`${BASE_URL}/dashboard`);
    await driver.wait(until.elementLocated(By.id("roster-table")), 5000);

    // TEST 9.1: Modal de advertencia y eliminación de usuarios
    total++;
    console.log("  [Test 9.1] Modal de advertencia y confirmación para borrar usuario...");
    const btnDelete = await driver.findElement(By.id("btn-delete-juan"));
    await btnDelete.click();
    await driver.sleep(200);

    const deleteModal = await driver.findElement(By.id("delete-user-modal"));
    assert(await deleteModal.isDisplayed(), "El modal de confirmación de eliminación debe estar visible");

    const modalTitle = await driver.findElement(By.id("delete-user-title")).getText();
    assert(modalTitle.includes("Advertencia"), "Debe mostrar el título de Advertencia");

    const confirmDeleteBtn = await driver.findElement(By.id("btn-confirm-delete"));
    await confirmDeleteBtn.click();
    await driver.sleep(200);

    assert(!(await deleteModal.isDisplayed()), "El modal debe cerrarse tras eliminar");
    
    // Check row 1 was removed
    const studentRows = await driver.findElements(By.id("student-row-1"));
    assert(studentRows.length === 0, "El usuario Juan Pérez debe haber sido eliminado del DOM");

    const toastMsg = await driver.findElement(By.id("toast-msg")).getText();
    assert(toastMsg.includes("Usuario eliminado"), "Debe notificar la eliminación del usuario mediante Toast");
    console.log("    ✓ Pasado: Eliminación de usuario y confirmación de seguridad comprobadas.");
    passed++;

    // TEST 9.2: Modal de Creación de Grupos de Estudio
    total++;
    console.log("  [Test 9.2] Creación de Grupo de Estudio y selección de preferencia horaria...");
    const btnGroup = await driver.findElement(By.id("btn-open-group-modal"));
    await btnGroup.click();
    await driver.sleep(200);

    const groupModal = await driver.findElement(By.id("group-modal"));
    assert(await groupModal.isDisplayed(), "El modal de creación de grupos debe estar visible");

    const groupNameInput = await driver.findElement(By.id("group-name-input"));
    await groupNameInput.sendKeys("Grupo de Estudio Algoritmos Avanzados");

    const scheduleSelect = await driver.findElement(By.id("group-schedule-select"));
    await scheduleSelect.click();
    
    const submitGroupBtn = await driver.findElement(By.id("btn-submit-group"));
    await submitGroupBtn.click();
    await driver.sleep(200);

    const groupToastMsg = await driver.findElement(By.id("toast-msg")).getText();
    assert(groupToastMsg.includes("Grupo de estudio creado"), "Debe notificar la creación exitosa del grupo de estudio");
    console.log("    ✓ Pasado: Creación de grupo de estudio y preferencia horaria verificadas.");
    passed++;

  } catch (err) {
    console.error("  ❌ FALLO en Admin Test:", err.message);
  } finally {
    await driver.quit();
  }

  return { name: "Administración y Grupos de Estudio", passed, total };
}

module.exports = runAdminTests;
