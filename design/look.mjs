import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const inner = readFileSync("design/forja.html", "utf8");
await page.setContent(
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui;background:#fafaf8}img{max-width:100%}[hidden]{display:none!important}</style>${inner}</head><body></body></html>`,
  { waitUntil: "networkidle" },
);
await page.waitForTimeout(1200);
await page.screenshot({ path: "design/look-top.png", clip: { x: 0, y: 0, width: 1280, height: 1100 } });
await page.screenshot({ path: "design/look-full.png", fullPage: true });
await browser.close();
console.log("ok");
