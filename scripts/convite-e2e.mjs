import { chromium } from "playwright";

const BASE = "http://localhost:3210";
const REF = process.env.SB_REF, TOKEN = process.env.SB_TOKEN;
const NOVO = `joana.teste.${Date.now()}@exemplo.com`;

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

async function entrar(email, senha = "demo1234") {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/entrar`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', senha);
  await Promise.all([page.waitForURL((u) => !u.pathname.includes("entrar")), page.click('main button[type="submit"]')]);
  return { ctx, page };
}

// 1 · A personal cria o convite pela tela.
const marina = await entrar("marina@studioguerra.app");
await marina.page.goto(`${BASE}/convites`, { waitUntil: "networkidle" });
await marina.page.fill('input[name="email"]', NOVO);
await marina.page.fill('input[name="fullName"]', "Joana Prado");
await marina.page.click('main form button[type="submit"]');
await marina.page.waitForTimeout(1200);
await marina.page.screenshot({ path: "shots/11-convites.png", fullPage: true });
console.log("1 · convite criado para", NOVO);

const [{ token }] = await sql(
  `select token from public.invites where email = '${NOVO}' and accepted_at is null`);

// 2 · A pessoa abre o link num navegador limpo.
const nova = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await nova.newPage();
await page.goto(`${BASE}/convite/${token}`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.screenshot({ path: "shots/12-convite-aberto.png", fullPage: true });
console.log("2 · tela de convite carregada:", await page.locator("h1").innerText());

// 3 · Cria a conta.
await page.fill('input[name="fullName"]', "Joana Prado");
await page.fill('input[name="password"]', "senhaforte123");
await page.fill('input[name="confirm"]', "senhaforte123");
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes("convite"), { timeout: 30000 }),
  page.click('form button[type="submit"]'),
]);
console.log("3 · entrou direto em", new URL(page.url()).pathname);
await page.waitForTimeout(800);
await page.screenshot({ path: "shots/13-primeiro-acesso.png", fullPage: true });

// 4 · A personal já enxerga a aluna nova.
await marina.page.goto(`${BASE}/painel`, { waitUntil: "networkidle" });
const nomes = await marina.page.locator("main a[href^='/alunos/'] span").allInnerTexts();
console.log("4 · painel da Marina:", nomes.filter((n) => n.length > 2 && !n.includes("·")).join(" | "));

// 5 · A aluna nova não enxerga ninguém além dela.
const linhas = await sql(`
  select p.full_name, p.role::text, count(a.id) as vinculos
  from public.profiles p left join public.assignments a on a.student_id = p.id
  where p.email = '${NOVO}' group by p.full_name, p.role`);
console.log("5 · no banco:", JSON.stringify(linhas));

await browser.close();
