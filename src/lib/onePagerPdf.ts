// Shared headless-Chromium rendering for the one-pager routes: the published PDF
// (schools/[school]/one-pager.pdf.ts), the secret-gated draft PDF
// (preview/schools/[slug]/one-pager.pdf.ts), and the PNG thumbnail shown in the
// Marketing Portal (schools/[school]/one-pager.png.ts). Both outputs print the
// same HTML page, so the thumbnail can never drift from the PDF a school
// downloads. Chromium: @sparticuz/chromium on Vercel; local Chrome in dev.

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

/**
 * Render the page at `pageUrl` to a PNG of just the sheet — the portal's
 * one-pager preview. Throws on failure.
 */
export async function renderOnePagerImage(pageUrl: string): Promise<Uint8Array> {
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    // 1.5× the 816×1056 sheet → a 1224×1584 PNG: sharp enough to open full
    // screen, but a fraction of the weight of the 2× the PDF path renders at.
    // (The dot-grid bands are expensive to encode, so this matters.)
    await page.setViewport({ ...LETTER, deviceScaleFactor: 1.5 });
    await page.goto(pageUrl, { waitUntil: "networkidle0", timeout: 45000 });
    await page.evaluate(() => (document as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready);

    // Screenshot the PRINT rendering, not the screen one — the same @media print
    // rules the PDF is produced under. That's what makes this a true preview of
    // the downloaded file, and it settles two problems on its own: the screen
    // layout centres the sheet in a flex row where it shrinks below its 8.5in
    // width (clipping the design's right edge), and the floating "Download PDF"
    // button is position:fixed over the sheet's corner, so it would otherwise
    // land in the shot.
    await page.emulateMediaType("print");

    const sheet = await page.$(".op-sheet");
    if (!sheet) throw new Error("one-pager sheet element not found");
    const png = await sheet.screenshot({ type: "png" });
    return new Uint8Array(png);
  } finally {
    await browser?.close();
  }
}
