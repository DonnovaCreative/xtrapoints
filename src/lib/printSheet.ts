// Shared headless-Chromium rendering for every printable per-school sheet: the
// sales one-pager (schools/[school]/one-pager.pdf.ts), its secret-gated draft
// (preview/schools/[slug]/one-pager.pdf.ts), the ambassador flyer
// (schools/[school]/ambassador-flyer.pdf.ts), and the PNG previews the Marketing
// Portal shows for each. Both outputs of a sheet print the SAME HTML page, so a
// thumbnail can never drift from the file a school downloads.
//
// Was onePagerPdf.ts, generalized when the flyer arrived: the sheet element's
// selector and the paper size are parameters now rather than one-pager constants,
// because the Campaign Set templates are not US-Letter.
//
// Chromium: @sparticuz/chromium on Vercel; local Chrome in dev.

// Vercel/Lambda set these; locally they're absent → use a desktop Chrome.
const isServerless = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME,
);

export interface SheetSize {
  width: number;
  height: number;
}

/** 8.5in × 11in at 100dpi — the default for both current templates. */
export const LETTER: SheetSize = { width: 850, height: 1100 };

async function launchBrowser(size: SheetSize, deviceScaleFactor: number) {
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
      defaultViewport: { ...size, deviceScaleFactor },
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
    defaultViewport: { ...size, deviceScaleFactor },
  });
}

/** Block until the page's web fonts have loaded, so the print matches the design. */
const awaitFonts = (page: { evaluate: (fn: () => unknown) => Promise<unknown> }) =>
  page.evaluate(() => (document as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready);

/**
 * Render the page at `pageUrl` to a PDF (bytes), sized by the page's own
 * `@page` rule. Throws on failure.
 */
export async function renderSheetPdf(
  pageUrl: string,
  { size = LETTER }: { size?: SheetSize } = {},
): Promise<Uint8Array> {
  let browser;
  try {
    browser = await launchBrowser(size, 2);
    const page = await browser.newPage();
    await page.goto(pageUrl, { waitUntil: "networkidle0", timeout: 45000 });
    await awaitFonts(page);
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true, // honor `@page { size: …; margin: 0 }`
    });
    return new Uint8Array(pdf);
  } finally {
    await browser?.close();
  }
}

/**
 * Render just the sheet element at `pageUrl` to a PNG — the portal's preview
 * image. Throws if the selector doesn't match, rather than silently shooting
 * the whole viewport.
 */
export async function renderSheetImage(
  pageUrl: string,
  {
    selector,
    size = LETTER,
    // 1.5× the sheet is sharp enough to open full screen at a fraction of the
    // weight of the 2× the PDF path renders at. (The one-pager's dot-grid bands
    // are expensive to encode, so this matters.)
    scale = 1.5,
  }: { selector: string; size?: SheetSize; scale?: number },
): Promise<Uint8Array> {
  let browser;
  try {
    browser = await launchBrowser(size, scale);
    const page = await browser.newPage();
    await page.setViewport({ ...size, deviceScaleFactor: scale });
    await page.goto(pageUrl, { waitUntil: "networkidle0", timeout: 45000 });
    await awaitFonts(page);

    // Screenshot the PRINT rendering, not the screen one — the same @media print
    // rules the PDF is produced under. That's what makes this a true preview of
    // the downloaded file, and it settles two problems on its own: the screen
    // layout centres the sheet in a flex row where it can shrink below its full
    // width (clipping the design's right edge), and the floating "Download"
    // button is position:fixed over the sheet's corner, so it would otherwise
    // land in the shot.
    await page.emulateMediaType("print");

    const sheet = await page.$(selector);
    if (!sheet) throw new Error(`sheet element not found: ${selector}`);
    const png = await sheet.screenshot({ type: "png" });
    return new Uint8Array(png);
  } finally {
    await browser?.close();
  }
}
