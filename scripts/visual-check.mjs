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
      if (await page.locator(".footer-admin-link").getAttribute("href") !== "/admin") throw new Error("Admin footer link is missing");
      await page.getByRole("button", { name: "Open menu" }).click();
      await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Men", exact: true }).click();
      await page.waitForURL(`${baseUrl}/men`);
      if (await page.locator("h1").textContent() !== "Men") throw new Error("Mobile collection navigation failed");
      await page.locator(".preview-product-card").first().waitFor();
      if (await page.locator(".preview-product-card").count() !== 7) throw new Error("The seven product previews are not visible");
      for (const image of await page.locator(".preview-product-card img").all()) {
        await image.scrollIntoViewIfNeeded();
        if (!(await image.evaluate(async (element) => { await element.decode().catch(() => {}); return element.naturalWidth > 0; }))) {
          throw new Error("A product preview image did not load");
        }
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: "/tmp/vegora-men-390-full.png", fullPage: true });
      await page.locator(".preview-product-card").first().click();
      await page.waitForURL(`${baseUrl}/product/navy-wide-stripe-tee`);
      await page.getByRole("heading", { name: "Navy Wide Stripe T-Shirt" }).waitFor();
      if (await page.locator(".product-thumbnails button").count() !== 2) throw new Error("Front/back product images are missing");
      await page.getByRole("button", { name: "Show image 2" }).click();
      if (!(await page.locator(".product-main-image img").getAttribute("src"))?.includes("navy-stripe-back.webp")) throw new Error("Product gallery did not switch images");
      if (!(await page.getByText("Test price", { exact: true }).isVisible())) throw new Error("Preview test price is not labelled");
      if (await page.locator(".add-bag-button").count() !== 0) throw new Error("Preview product must not be orderable");
      await page.screenshot({ path: "/tmp/vegora-product-390.png", fullPage: true });
      await page.route("**/api/products/navy-wide-stripe-tee", (route) => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ product: {
          id: "navy-wide-stripe-tee", slug: "navy-wide-stripe-tee", name: "Navy Wide Stripe T-Shirt",
          description: "Test product", audience: "men", category: "T-Shirts", priceMinor: 10000,
          currency: "GHS", images: [{ url: "/catalog/navy-stripe-front.webp", alt: "Navy striped shirt" }],
          variants: [{ id: "size-s", sku: "VG-NAVY-S", size: "S", stock: 3 }, { id: "size-m", sku: "VG-NAVY-M", size: "M", stock: 0 }],
          status: "published", featured: false, createdAt: "", updatedAt: "",
        } }),
      }));
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "S", exact: true }).waitFor();
      if (!(await page.locator(".add-bag-button").isDisabled())) throw new Error("Size selection was not required");
      if (!(await page.getByRole("button", { name: "M", exact: true }).isDisabled())) throw new Error("Out-of-stock size is selectable");
      await page.getByRole("button", { name: "S", exact: true }).click();
      if (await page.locator(".add-bag-button").isDisabled()) throw new Error("In-stock size cannot be added");
      await page.locator(".add-bag-button").click();
      await page.getByText("Added to your bag.").waitFor();
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
