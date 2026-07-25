const { createDriver, BASE_URL, assert, assertEqual, By, until } = require("./config");

async function runLoginTests() {
  console.log("\n🔒 --- Ejecutando Tests Selenium: Autenticación e Inicio de Sesión ---");
  const driver = await createDriver();
  let passed = 0;
  let total = 0;

  try {
    // TEST 1: Carga de página de Login
    total++;
    console.log("  [Test 1.1] Verificar carga y título de la página /login...");
    await driver.get(`${BASE_URL}/login`);
    await driver.wait(until.elementLocated(By.tagName("h1")), 5000);
    const titleText = await driver.findElement(By.tagName("h1")).getText();
    assert(titleText.includes("Jutsu Classroom"), "El título debe contener Jutsu Classroom");
    console.log("    ✓ Pasado: Título principal verificado.");
    passed++;

    // TEST 2: Alternar entre Iniciar Sesión y Registrarse
    total++;
    console.log("  [Test 1.2] Alternar formulario entre Iniciar Sesión y Registrate gratis...");
    const toggleButton = await driver.findElement(By.xpath("//button[contains(text(), 'Registrate gratis')]"));
    await toggleButton.click();
    
    await driver.sleep(300);
    const subtitleText = await driver.findElement(By.xpath("//p[contains(text(), 'cuenta académica')]")).getText();
    assert(subtitleText.includes("Creá tu cuenta académica"), "El subtítulo debe cambiar a modo registro");

    const backToLogin = await driver.findElement(By.xpath("//button[contains(text(), 'Iniciá sesión')]"));
    await backToLogin.click();
    await driver.sleep(300);
    console.log("    ✓ Pasado: Alternancia de formularios de Auth verificada.");
    passed++;

    // TEST 3: Verificar campos de entrada e iconos de proveedores
    total++;
    console.log("  [Test 1.3] Verificar campos de correo, contraseña y proveedores OAuth...");
    const emailInput = await driver.findElement(By.id("email"));
    const passwordInput = await driver.findElement(By.id("password"));
    const googleButton = await driver.findElement(By.xpath("//button[.//span[text()='Google']]"));
    const githubButton = await driver.findElement(By.xpath("//button[.//span[text()='GitHub']]"));

    assert(await emailInput.isDisplayed(), "Campo de email debe estar visible");
    assert(await passwordInput.isDisplayed(), "Campo de contraseña debe estar visible");
    assert(await googleButton.isDisplayed(), "Botón Google debe estar visible");
    assert(await githubButton.isDisplayed(), "Botón GitHub debe estar visible");
    console.log("    ✓ Pasado: Campos e iconos OAuth verificados.");
    passed++;

    // TEST 4: Validación de envío con campos vacíos
    total++;
    console.log("  [Test 1.4] Ingresar credenciales y verificar botón de envío...");
    await emailInput.sendKeys("test_docente@unrn.edu.ar");
    await passwordInput.sendKeys("password123");
    const submitBtn = await driver.findElement(By.xpath("//button[@type='submit']"));
    assert(await submitBtn.isDisplayed(), "El botón de envío debe estar visible");
    console.log("    ✓ Pasado: Entrada de texto e interactividad de submit verificadas.");
    passed++;

  } catch (err) {
    console.error("  ❌ FALLO en Login Test:", err.message);
  } finally {
    await driver.quit();
  }

  return { name: "Autenticación / Login", passed, total };
}

module.exports = runLoginTests;
