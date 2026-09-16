import { chromium } from "playwright";

const BASE = "http://localhost:3210";
const { SB_REF, SB_TOKEN } = process.env;

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${SB_REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SB_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const contar = async () =>
  (await sql(`select count(*)::int as n from public.set_logs l
              join public.workout_sessions s on s.id = l.session_id
              join public.profiles p on p.id = s.student_id
              where p.email = 'bruno@exemplo.com'`))[0].n;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

// Começa online: entra e abre o treino.
await page.goto(`${BASE}/entrar`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "bruno@exemplo.com");
await page.fill('input[name="password"]', "demo1234");
await Promise.all([page.waitForURL((u) => !u.pathname.includes("entrar")), page.click('main button[type="submit"]')]);
await page.goto(`${BASE}/treino`, { waitUntil: "networkidle" });
await page.locator('main form button[type="submit"]').first().click();
await page.waitForURL(/\/treino\/.+/);
await page.waitForTimeout(800);

const antes = await contar();
console.log(`séries do Bruno no banco antes: ${antes}`);

// ————— corta a rede —————
await ctx.setOffline(true);
console.log("\n· rede cortada");

const ticks = page.locator('button[aria-label^="Registrar série"]');
for (const i of [0, 1, 2, 3]) {
  await ticks.nth(i).click();
  await page.waitForTimeout(300);
}
await page.waitForTimeout(1500);
const aviso = await page.locator('[role="status"]').innerText().catch(() => "(sem aviso)");
console.log("· registrou 4 séries offline");
console.log("· aviso na tela:", JSON.stringify(aviso.replace(/\s+/g, " ").trim()));
await page.screenshot({ path: "shots/14-offline.png", fullPage: true });

const durante = await contar();
console.log(`· no banco durante o offline: ${durante} (esperado ${antes} — nada subiu ainda)`);

// Recarrega sem rede: o service worker precisa servir a página.
const recarregou = await page.reload({ waitUntil: "domcontentloaded" }).then(() => true).catch(() => false);
console.log("· recarregou a página sem rede:", recarregou ? "sim (service worker)" : "não");

// ————— rede volta —————
await ctx.setOffline(false);
console.log("\n· rede restabelecida");
await page.waitForTimeout(1000);
await page.evaluate(() => window.dispatchEvent(new Event("online")));

let depois = antes;
for (let tentativa = 0; tentativa < 20 && depois < antes + 4; tentativa++) {
  await page.waitForTimeout(1000);
  depois = await contar();
}
console.log(`· no banco depois: ${depois} (esperado ${antes + 4})`);

const registros = await sql(`select e.name, l.set_index, l.reps, l.load_kg
  from public.set_logs l
  join public.workout_sessions s on s.id = l.session_id
  join public.profiles p on p.id = s.student_id
  join public.exercises e on e.id = l.exercise_id
  where p.email = 'bruno@exemplo.com' order by l.completed_at desc limit 4`);
console.log("· últimas séries:", registros.map((r) => `${r.name} #${r.set_index} ${r.reps}×${r.load_kg}`).join(" | "));

// Reenvio não pode duplicar.
await page.evaluate(() => window.dispatchEvent(new Event("online")));
await page.waitForTimeout(2500);
console.log(`· depois de forçar reenvio: ${await contar()} (não pode crescer)`);

await browser.close();
