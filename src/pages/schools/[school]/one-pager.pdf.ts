// On-demand co-branded sales one-pager PDF at /schools/<slug>/one-pager.pdf.
// A Vercel serverless function renders the sibling HTML page
// (/schools/<slug>/one-pager) to a single US-Letter PDF via headless Chromium,
// then it's CDN-cached — same on-demand pattern as og.png.ts, so build time
// stays flat no matter how many schools exist.
//
// Chromium: @sparticuz/chromium (a Lambda-friendly build) in production; a
// locally-installed Chrome in dev (override with CHROME_PATH).
import type { APIRoute } from "astro";
import { getSchool } from "@/data/schoolsSource";

export const prerender = false;

// Vercel/Lambda set these; locally they're absent → use a desktop Chrome.
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

const LETTER = { width: 850, height: 1100 }; // 8.5in × 11in at 100dpi (layout viewport)

async function launchBrowser() {
  const puppeteer = (await import("puppeteer-core")).default;

  if (isServerless) {
    // @sparticuz/chromium detects "am I on Lambda?" from AWS_EXECUTION_ENV /
    // AWS_LAMBDA_JS_RUNTIME to decide whether to extract its bundled glibc libs
    // (libnss3, etc.) and set LD_LIBRARY_PATH. Vercel runs functions on Lambda
    // but does NOT set those vars, so without this the libs never extract and
    // Chromium dies with "libnss3.so: cannot open shared object file". Vercel's
    // Node 20/22 functions run on Amazon Linux 2023 — opt into that lib set.
    // Must be set BEFORE the import (the detection runs at module-eval time).
    process.env.AWS_LAMBDA_JS_RUNTIME ||= "nodejs20.x";
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
      defaultViewport: { ...LETTER, deviceScaleFactor: 2 },
    });
  }

  // Local development — point puppeteer-core at an installed Chrome.
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

export const GET: APIRoute = async ({ params, url }) => {
  const slug = params.school;
  const school = slug ? await getSchool(slug) : undefined;
  if (!school) return new Response("Not found", { status: 404 });

  // Render the sibling HTML page on this same deployment.
  const pageUrl = new URL(`/schools/${slug}/one-pager`, url.origin).href;

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.goto(pageUrl, { waitUntil: "networkidle0", timeout: 45000 });
    // Wait for the web fonts (Anton / Space Mono / Inter) to finish loading so
    // the printed layout matches the browser exactly.
    await page.evaluate(() => (document as any).fonts?.ready);
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true, // honor the page's `@page { size: Letter; margin: 0 }`
    });

    const filename = `${school.short.replace(/[^\w-]+/g, "-")}-XtraPoint-One-Pager.pdf`;
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        // A rebrand triggers a fresh deployment (new function), so a long cache
        // is safe — mirrors the OG endpoint.
        "Cache-Control": "public, max-age=3600",
        "CDN-Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error("one-pager PDF render failed:", err);
    // TEMP staging diagnostics — revert before production.
    const msg = err instanceof Error ? `${err.message}\n\n${err.stack}` : String(err);
    return new Response(`PDF generation failed:\n${msg}`, { status: 500 });
  } finally {
    await browser?.close();
  }
};
