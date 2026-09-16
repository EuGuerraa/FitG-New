import { chromium } from "playwright";

const BASE = "http://localhost:3210";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

async function open(login, { width = 390, height = 844 } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/entrar`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', login);
  await page.fill('input[name="password"]', "demo1234");
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("entrar")),
    page.click('button[type="submit"]'),
  ]);
  return { ctx, page };
}

async function shot(page, name) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `shots/${name}.png`, fullPage: true });
  console.log("→", name);
}

// 01 login
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/entrar`, { waitUntil: "networkidle" });
  await shot(page, "01-login");
  await ctx.close();
}

// 02 hoje + 03 plano + 04 execução (aluna Ana)
{
  const { ctx, page } = await open("ana@exemplo.com");
  await shot(page, "02-hoje");

  await page.goto(`${BASE}/treino`, { waitUntil: "networkidle" });
  await shot(page, "03-plano");

  // Começa o treino e registra três séries para ver a barra de descanso viva.
  await page.locator('main form button[type="submit"]').first().click();
  await page.waitForURL(/\/treino\/.+/);
  await page.waitForTimeout(400);
  const ticks = page.locator('button[aria-label^="Registrar série"]');
  for (const i of [0, 1, 2]) {
    await ticks.nth(i).click();
    await page.waitForTimeout(250);
  }
  await shot(page, "04-execucao");

  await page.click('button:has-text("Encerrar")');
  await page.waitForTimeout(300);
  await shot(page, "05-encerrar");

  // Conclui de verdade, para as telas seguintes terem histórico real.
  await page.click('button:has-text("8")');
  await page.click('button:has-text("Encerrar treino")');
  await page.waitForURL(/\/treino/);
  await page.waitForTimeout(600);
  await shot(page, "06-plano-com-historico");
  await ctx.close();
}

// 06 painel do personal + 07 ficha do aluno
{
  const { ctx, page } = await open("igor@studioguerra.app");
  await shot(page, "07-painel");
  await page.click("a[href^='/alunos/']");
  await page.waitForTimeout(500);
  await shot(page, "08-ficha-aluno");
  await ctx.close();
}

// 08 desktop
{
  const { ctx, page } = await open("igor@studioguerra.app", { width: 1280, height: 860 });
  await shot(page, "09-desktop");
  await ctx.close();
}

await browser.close();
