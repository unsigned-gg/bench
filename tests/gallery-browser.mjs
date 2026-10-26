import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
const root = resolve("cerebral"),
  inventory = JSON.parse(
    await readFile("cerebral-src/visualizations/inventory.json", "utf8"),
  );
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".tiff": "image/tiff",
};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://local");
    let file = resolve(root, "." + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + "/") && file !== root) throw Error("path");
    if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
    res.setHeader("Content-Type", mime[extname(file)] || "text/plain");
    res.end(await readFile(file));
  } catch {
    res.statusCode = 404;
    res.end("Not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
await mkdir("test-results/gallery", { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  headless: true,
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
  ],
});
const checks = [],
  errors = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  const select = async (id) => {
    await page
      .locator(`#catalog-list a[data-example="${id}"]`)
      .evaluate((a) => a.click());
    await page.waitForFunction(
      (id) =>
        document.querySelector("#chart").dataset.example === id ||
        !!document.querySelector("#chart").dataset.error,
      id,
    );
    assert.equal(
      await page.locator("#chart").getAttribute("data-error"),
      null,
      id,
    );
  };
  await page.goto(base + "/visualizations/", { waitUntil: "networkidle" });
  await page.waitForFunction(
    () => document.querySelector("#chart").dataset.example,
  );
  assert.match(await page.locator(".runtime").innerText(), /WASM \/ ready/);
  assert.match(await page.locator(".runtime").innerText(), /WebGL ready/);
  for (const item of inventory.entries) {
    await select(item.id);
    const geometry = await page.locator("#chart").evaluate((canvas) => {
      const scratch = document.createElement("canvas");
      scratch.width = 128;
      scratch.height = 80;
      const context = scratch.getContext("2d");
      context.drawImage(canvas, 0, 0, 128, 80);
      const pixels = context.getImageData(0, 0, 128, 80).data;
      const background = [pixels[0], pixels[1], pixels[2]];
      let changed = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (
          Math.abs(pixels[i] - background[0]) +
            Math.abs(pixels[i + 1] - background[1]) +
            Math.abs(pixels[i + 2] - background[2]) >
          18
        )
          changed++;
      return {
        marks: Number(canvas.dataset.marks),
        vertices: Number(canvas.dataset.vertices),
        changed,
      };
    });
    assert.ok(
      geometry.marks > 0 && geometry.vertices > 0 && geometry.changed > 8,
      `${item.title}: empty render ${JSON.stringify(geometry)}`,
    );
    checks.push({ id: item.id, ...geometry });
  }
  console.log("174 examples: finite GPU geometry and nonempty pixels");
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ["light", "dark"]) {
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page.locator("#lab-theme").click();
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      assert.deepEqual(
        result.violations,
        [],
        `${width} ${theme} accessibility`,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `${width} overflow`,
      );
    }
  }
  console.log(
    "Responsive light/dark accessibility: zero violations and no overflow",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel("Find a visualization").fill("treemap");
  assert.match(await page.locator("#catalog-status").innerText(), /5 of 174/);
  await page.getByLabel("Find a visualization").fill("zznonesuch");
  assert.match(await page.locator("#catalog-status").innerText(), /0 of 174/);
  await page.getByLabel("Find a visualization").fill("");
  await page.getByLabel("Category", { exact: true }).selectOption("maps");
  assert.match(await page.locator("#catalog-status").innerText(), /22 of 174/);
  await page.getByLabel("Category", { exact: true }).selectOption("all");
  await select("d3-zoomable-treemap");
  const before = await page.locator("#chart").getAttribute("data-vertices");
  await page.locator("#action").click();
  assert.notEqual(
    await page.locator("#chart").getAttribute("data-vertices"),
    before,
  );
  await page.locator("#reset").click();
  assert.equal(
    await page.locator("#chart").getAttribute("data-vertices"),
    before,
  );
  await select("d3-brushable-scatterplot");
  const box = await page.locator("#chart").boundingBox();
  await page.mouse.move(box.x + 50, box.y + 50);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.8);
  await page.mouse.up();
  assert.match(
    await page.locator("#selection-status").innerText(),
    /marks selected/,
  );
  await page.locator("#chart").focus();
  await page.keyboard.press("ArrowRight");
  assert.ok((await page.locator("#chart-tooltip").innerText()).length > 0);
  await select("d3-zoomable-bar-chart");
  const initial = await page.locator("#chart-labels").innerHTML();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  assert.notEqual(await page.locator("#chart-labels").innerHTML(), initial);
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await select("mbostock-owls-to-the-max");
  const coarse = await page.locator("#chart").getAttribute("data-marks");
  await page.locator("#action").click();
  assert.ok(
    Number(await page.locator("#chart").getAttribute("data-marks")) >
      Number(coarse),
  );
  await select("d3-new-zealand-tourists-1921-2018");
  const linear = await page.locator("#chart").getAttribute("data-vertices");
  await page.locator("#action").click();
  assert.ok(Number(linear) > 0);
  await select("d3-versor-dragging");
  let imageBefore = await page.locator("#chart").evaluate((c) => c.toDataURL());
  let bounds = await page.locator("#chart").boundingBox();
  await page.mouse.move(
    bounds.x + bounds.width * 0.5,
    bounds.y + bounds.height * 0.5,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width * 0.6,
    bounds.y + bounds.height * 0.65,
  );
  await page.mouse.up();
  assert.notEqual(
    await page.locator("#chart").evaluate((c) => c.toDataURL()),
    imageBefore,
    "Quaternion dragging rotates the globe",
  );
  await select("d3-zoom-to-bounding-box");
  imageBefore = await page.locator("#chart").evaluate((c) => c.toDataURL());
  bounds = await page.locator("#chart").boundingBox();
  await page.mouse.click(
    bounds.x + bounds.width * 0.5,
    bounds.y + bounds.height * 0.5,
  );
  assert.notEqual(
    await page.locator("#chart").evaluate((c) => c.toDataURL()),
    imageBefore,
    "Country bounding-box selection changes view",
  );
  await select("d3-stacked-to-grouped-bars");
  await page.locator("#frame").fill("25");
  const quarter = await page.locator("#chart").evaluate((c) => c.toDataURL());
  await page.locator("#frame").fill("75");
  assert.notEqual(
    await page.locator("#chart").evaluate((c) => c.toDataURL()),
    quarter,
    "Stacked/grouped positions interpolate",
  );
  assert.match(page.url(), /frame=75/);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator("#frame").inputValue(), "75");
  await select("d3-bar-chart-2");
  await page.locator("#chart").focus();
  await page.keyboard.press("ArrowRight");
  const tooltipValue = Number(
    (await page.locator("#chart-tooltip").innerText()).split(":").at(-1),
  );
  const tableValue = Number(
    await page
      .locator("#data-body tr")
      .first()
      .locator("td")
      .nth(2)
      .textContent(),
  );
  assert.ok(
    Math.abs(tooltipValue - tableValue) < 0.001,
    "Bar heights preserve the input quantity",
  );

  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator("#example-title").innerText(), "Bar chart");
  assert.equal(await page.locator("#play").isDisabled(), true);
  await page.goto(base + "/visualizations/", { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  assert.equal(
    await page.locator(":focus").innerText(),
    "Skip to visualization",
  );
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(":focus").getAttribute("id"), "lab-content");
  const download = page.waitForEvent("download");
  await page.locator("#download-data").click();
  assert.match((await download).suggestedFilename(), /demo\.csv$/);
  await page.screenshot({
    path: "test-results/gallery/desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/gallery/mobile.png",
    fullPage: true,
  });
  const animated = await browser.newContext({
    viewport: { width: 1100, height: 900 },
    reducedMotion: "no-preference",
  });
  const a = await animated.newPage();
  await a.goto(base + "/visualizations/?chart=d3-animated-treemap", {
    waitUntil: "networkidle",
  });
  await a.waitForFunction(
    () => document.querySelector("#chart").dataset.example,
  );
  const frame = await a.locator("#frame").inputValue();
  await a.locator("#play").click();
  await a.waitForFunction(
    (frame) => document.querySelector("#frame").value !== frame,
    frame,
  );
  await a.locator("#play").click();
  assert.equal(await a.locator("#play").getAttribute("aria-pressed"), "false");
  await animated.close();
  const unavailable = await browser.newContext();
  const f = await unavailable.newPage();
  await f.route("**/kernels.wasm", (route) => route.abort());
  await f.goto(base + "/visualizations/", { waitUntil: "networkidle" });
  await f.locator("#renderer-error").waitFor({ state: "visible" });
  assert.match(await f.locator("#wasm-status").innerText(), /unavailable/);
  assert.equal(await f.locator("#catalog-list a").count(), 174);
  await unavailable.close();
  const noGL = await browser.newContext();
  await noGL.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (
        type === "webgl" ||
        type === "webgl2" ||
        type === "experimental-webgl"
      )
        return null;
      return original.call(this, type, ...args);
    };
  });
  const g = await noGL.newPage();
  await g.goto(base + "/visualizations/", { waitUntil: "networkidle" });
  await g.locator("#renderer-error").waitFor({ state: "visible" });
  assert.match(await g.locator("#webgl-status").innerText(), /unavailable/);
  assert.equal(await g.locator("#catalog-list a").count(), 174);
  await noGL.close();
  const nojs = await browser.newContext({ javaScriptEnabled: false });
  const n = await nojs.newPage();
  await n.goto(base + "/visualizations/");
  assert.equal(await n.locator("#catalog-list a").count(), 174);
  assert.match(await n.locator("noscript").innerText(), /JavaScript/);
  await nojs.close();
  assert.deepEqual(errors, []);
  console.log(
    "Search, filters, drill/reset, brush, keyboard inspection, zoom, refinement, links, CSV, motion and failure fallback pass",
  );
  await writeFile(
    "test-results/gallery/coverage.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
