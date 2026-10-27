import { chromium } from "playwright-core";

const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const baseUrl = process.env.VEGORA_BASE_URL || "http://127.0.0.1:3000";
const widths = [320, 390, 768, 1440];

try {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: width < 500 ? 844 : 1000 }, deviceScaleFactor: 1 });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    const state = await page.evaluate(() => ({
      width: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      title: document.querySelector("h1")?.textContent?.trim(),
      searchVisible: (() => { const el = document.querySelector('[aria-label="Search"]'); return !!el && el.getBoundingClientRect().right <= window.innerWidth; })(),
      bagVisible: (() => { const el = document.querySelector('[aria-label="Shopping bag"]'); return !!el && el.getBoundingClientRect().right <= window.innerWidth; })(),
    }));
    if (state.scrollWidth > state.width || !state.searchVisible || !state.bagVisible || !state.title) {
      throw new Error(`Storefront layout check failed at ${width}px: ${JSON.stringify(state)}`);
    }
    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 0.75));
    const layering = await page.evaluate(() => {
      const hero = document.querySelector(".gallery-hero");
      const surface = document.querySelector(".home-surface");
      if (!hero || !surface) return null;
      return {
        heroPosition: getComputedStyle(hero).position,
        heroTop: Math.round(hero.getBoundingClientRect().top),
        surfaceTop: Math.round(surface.getBoundingClientRect().top),
        surfaceLayer: Number(getComputedStyle(surface).zIndex),
        heroLayer: Number(getComputedStyle(hero).zIndex),
      };
    });
    if (!layering || layering.heroPosition !== "sticky" || Math.abs(layering.heroTop) > 2 || layering.surfaceLayer <= layering.heroLayer) {
      throw new Error(`Pinned hero check failed at ${width}px: ${JSON.stringify(layering)}`);
    }
    await page.screenshot({ path: `/tmp/vegora-${width}-scroll.png` });
    for (const image of await page.locator("img").all()) {
      await image.scrollIntoViewIfNeeded();
      const loaded = await image.evaluate(async (element) => {
        if (!(element instanceof HTMLImageElement)) return false;
        await element.decode().catch(() => {});
        return element.naturalWidth > 0;
      });
      if (!loaded) throw new Error(`Broken editorial image at ${width}px`);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `/tmp/vegora-${width}-full.png`, fullPage: true });
    console.log(JSON.stringify({ ...state, layering }));
    if (width === 390) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Men", exact: true }).click();
      await page.waitForURL(`${baseUrl}/men`);
      if (await page.locator("h1").textContent() !== "Men") throw new Error("Mobile collection navigation failed");
      await page.locator('.header-actions a[aria-label="Shopping bag"]').click();
      await page.waitForURL(`${baseUrl}/bag`);
      if (!(await page.getByRole("heading", { name: "Shopping bag" }).isVisible())) throw new Error("Bag navigation failed");
      await page.goto(`${baseUrl}/checkout`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.getByRole("heading", { name: "Checkout is being prepared." }).waitFor({ timeout: 30000 });
      const checkoutWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      if (checkoutWidth > width) throw new Error("Checkout overflows at 390px");
      await page.goto(`${baseUrl}/checkout/return?reference=invalid`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.getByRole("heading", { name: "We could not confirm your payment" }).waitFor({ timeout: 30000 });
    }
    await page.close();
  }
} finally {
  await browser.close();
}
