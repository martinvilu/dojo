const { createDriver, BASE_URL, assert, assertEqual, By, until } = require("./config");

async function runLoginTests() {
  console.log("\n🔒 --- Ejecutando Tests Selenium: Autenticación e Inicio de Sesión ---");
  const driver = await createDriver();
  let passed = 0;
  let total = 0;

  try {
    // TEST 1.1: Carga y Título de Página /login
    total++;
    console.log("  [Test 1.1] Verificar carga y título de la página /login...");
    await driver.get(`${BASE_URL}/login`);
    await driver.wait(until.elementLocated(By.tagName("h1")), 5000);
    const titleText = await driver.findElement(By.tagName("h1")).getText();
    assert(titleText.includes("Jutsu Classroom"), "El título debe contener Jutsu Classroom");
    console.log("    ✓ Pasado: Título principal verificado.");
    passed++;

    // TEST 1.2: Alternancia entre Iniciar Sesión y Registro
    total++;
    console.log("  [Test 1.2] Alternar formulario entre Iniciar Sesión y Registrate gratis...");
    const toggleButton = await driver.findElement(By.id("btn-toggle-mode"));
    await toggleButton.click();
    await driver.sleep(200);
    
    let subtitleText = await driver.findElement(By.id("auth-subtitle")).getText();
    assert(subtitleText.includes("cuenta académica"), "El subtítulo debe cambiar a modo registro");

    await toggleButton.click();
    await driver.sleep(200);
    subtitleText = await driver.findElement(By.id("auth-subtitle")).getText();
    assert(subtitleText.includes("plataforma central"), "El subtítulo debe volver a modo inicio de sesión");
    console.log("    ✓ Pasado: Alternancia de formularios de Auth verificada.");
    passed++;

    // TEST 1.3: Verificar campos de correo, contraseña y proveedores OAuth
    total++;
    console.log("  [Test 1.3] Verificar campos de correo, contraseña y proveedores OAuth...");
    const emailInput = await driver.findElement(By.id("email"));
    const passwordInput = await driver.findElement(By.id("password"));
    const googleButton = await driver.findElement(By.id("btn-google"));
    const githubButton = await driver.findElement(By.id("btn-github"));

    assert(await emailInput.isDisplayed(), "Campo de email debe estar visible");
    assert(await passwordInput.isDisplayed(), "Campo de contraseña debe estar visible");
    assert(await googleButton.isDisplayed(), "Botón Google debe estar visible");
    assert(await githubButton.isDisplayed(), "Botón GitHub debe estar visible");
    console.log("    ✓ Pasado: Campos e iconos OAuth verificados.");
    passed++;

    // TEST 1.4: Ingresar credenciales y enviar formulario
    total++;
    console.log("  [Test 1.4] Ingresar credenciales y verificar redirección a Dashboard...");
    await emailInput.sendKeys("docente@unrn.edu.ar");
    await passwordInput.sendKeys("Password123!");
    const submitBtn = await driver.findElement(By.id("btn-submit"));
    assert(await submitBtn.isDisplayed(), "El botón de envío debe estar visible");
    await submitBtn.click();
    await driver.sleep(400);

    const currentUrl = await driver.getCurrentUrl();
    assert(currentUrl.includes("/dashboard"), "Debe redirigir al Dashboard tras iniciar sesión");
    console.log("    ✓ Pasado: Autenticación exitosa y redirección a Dashboard comprobada.");
    passed++;

  } catch (err) {
    console.error("  ❌ FALLO en Login Test:", err.message);
  } finally {
    await driver.quit();
  }

  return { name: "Autenticación / Login", passed, total };
}

module.exports = runLoginTests;
