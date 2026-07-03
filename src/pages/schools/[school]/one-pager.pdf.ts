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
    return new Response("PDF generation failed", { status: 500 });
  } finally {
    await browser?.close();
  }
};
