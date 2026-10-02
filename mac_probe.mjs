// Runs the ADA lab probe + detect pages on this macOS runner, headed and headless,
// with Google Chrome (runner-installed) and Playwright's Chromium. Prints the facts
// that decide the headless verdict and saves everything under results/.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const base = (process.env.CENSUS_BASE || "").replace(/\/$/, "");
mkdirSync("results", { recursive: true });
const summary = [];

const facts = () => (async () => {
  const q = (s) => matchMedia(s).matches;
  let map = null;
  try {
    const m = await navigator.keyboard.getLayoutMap();
    map = { size: m.size, IntlYen: m.has("IntlYen"), IntlRo: m.has("IntlRo") };
  } catch (e) { map = { error: String(e) }; }
  const det = {};
  for (const n of ["headless", "ads_power", "dolphin_anty", "gologin", "multilogin", "octo"]) {
    const f = window["detect_" + n];
    if (typeof f !== "function") { det[n] = "n/a"; continue; }
    try { det[n] = await f(); } catch (e) { det[n] = "ERR " + e.message; }
  }
  return {
    ua: navigator.userAgent, platform: navigator.platform,
    screen: `${screen.width}x${screen.height} avail ${screen.availWidth}x${screen.availHeight}`,
    inner: `${innerWidth}x${innerHeight}`, outer: `${outerWidth}x${outerHeight}`,
    dpr: devicePixelRatio, maxTouchPoints: navigator.maxTouchPoints,
    pointer: { none: q("(pointer: none)"), fine: q("(pointer: fine)"), anyNone: q("(any-pointer: none)") },
    hover: { none: q("(hover: none)"), hover: q("(hover: hover)"), anyNone: q("(any-hover: none)") },
    keyboardMap: map, webdriver: navigator.webdriver, chrome: typeof window.chrome,
    policy: (document.permissionsPolicy || document.featurePolicy)
      ? (document.permissionsPolicy || document.featurePolicy).allowedFeatures().length : null,
    detectors: det,
  };
})();

for (const [channel, headless] of [["chrome", false], ["chrome", true], ["chromium", false], ["chromium", true]]) {
  const tag = `mac-${channel}_${headless ? "headless" : "headed"}`;
  const opts = { headless, args: ["--no-first-run"] };
  if (channel === "chrome") opts.channel = "chrome";
  let browser;
  try { browser = await chromium.launch(opts); }
  catch (e) { console.log(`[${tag}] launch failed: ${String(e.message).split("\n")[0]}`); continue; }
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  await ctx.addInitScript(`window.__lab_truth = ${JSON.stringify({ preset: `mac-${channel}`, headless })};`);
  const page = await ctx.newPage();
  const rec = { tag, version: browser.version() };
  try {
    if (base) {
      await page.goto(`${base}/probe`, { waitUntil: "load", timeout: 60000 });
      await page.waitForTimeout(20000); // probe posts its snapshot to the census when done
      await page.goto(`${base}/detect`, { waitUntil: "load", timeout: 60000 });
      await page.waitForTimeout(8000);  // detect page runs the six files and posts
    } else {
      await page.goto("about:blank");
    }
    rec.facts = await page.evaluate(facts);
  } catch (e) {
    rec.error = String(e.message).split("\n")[0];
  }
  await browser.close();
  summary.push(rec);
  writeFileSync(`results/${tag}.json`, JSON.stringify(rec, null, 2));
  const f = rec.facts || {};
  console.log(`[${tag}] v${rec.version} ${rec.error ? "ERROR " + rec.error : ""}`);
  if (f.keyboardMap) {
    console.log(`  keyboardMap=${JSON.stringify(f.keyboardMap)} pointer=${JSON.stringify(f.pointer)} hover=${JSON.stringify(f.hover)}`);
    console.log(`  screen=${f.screen} inner=${f.inner} outer=${f.outer} dpr=${f.dpr} touch=${f.maxTouchPoints} policyFeatures=${f.policy}`);
    console.log(`  detectors=${JSON.stringify(f.detectors)}  <- headless must be ${headless}`);
  }
}
writeFileSync("results/summary.json", JSON.stringify(summary, null, 2));
const bad = summary.filter((r) => r.facts && r.facts.detectors.headless !== r.tag.endsWith("headless"));
console.log(bad.length ? `\nHEADLESS VERDICT WRONG on: ${bad.map((r) => r.tag).join(", ")}` : "\nall headless verdicts correct");
