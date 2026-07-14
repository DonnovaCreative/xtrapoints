// Shared headless-Chromium PDF rendering for the one-pager routes: the published
// PDF (schools/[school]/one-pager.pdf.ts) and the secret-gated draft PDF
// (preview/schools/[slug]/one-pager.pdf.ts). Prints a given page URL to a single
// US-Letter PDF. Chromium: @sparticuz/chromium on Vercel; local Chrome in dev.

// Vercel/Lambda set these; locally they're absent → use a desktop Chrome.
const isServerless = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME,
);

const LETTER = { width: 850, height: 1100 }; // 8.5in × 11in at 100dpi

async function launchBrowser() {
  const puppeteer = (await import("puppeteer-core")).default;

  if (isServerless) {
    // @sparticuz/chromium detects Lambda from AWS_EXECUTION_ENV /
    // AWS_LAMBDA_JS_RUNTIME to decide whether to extract its bundled glibc libs
    // (libnss3, etc.) and set LD_LIBRARY_PATH. Vercel runs on Lambda but doesn't
    // set those, so without this Chromium dies with "libnss3.so: cannot open
    // shared object file". Must be set BEFORE the import (detection runs at
    // module-eval time).
    process.env.AWS_LAMBDA_JS_RUNTIME ||= "nodejs20.x";
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
      defaultViewport: { ...LETTER, deviceScaleFactor: 2 },
    });
  }

  const executablePath =
    process.env.CHROME_PATH ||
    (process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : "/usr/bin/google-chrome");
  return puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { ...LETTER, deviceScaleFactor: 2 },
  });
}

/** Render the page at `pageUrl` to a US-Letter PDF (bytes). Throws on failure. */
export async function renderOnePagerPdf(pageUrl: string): Promise<Uint8Array> {
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.goto(pageUrl, { waitUntil: "networkidle0", timeout: 45000 });
    // Wait for web fonts (Inter Display / Space Mono) so the print matches.
    await page.evaluate(() => (document as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready);
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true, // honor `@page { size: Letter; margin: 0 }`
    });
    return new Uint8Array(pdf);
  } finally {
    await browser?.close();
  }
}
