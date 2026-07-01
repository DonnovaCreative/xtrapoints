// =============================================================================
// OPEN GRAPH CARD GENERATOR (build-time) for the co-branded school pages.
//
// Renders a 1200×630 PNG that mirrors the donor-page hero: dark `ink`
// background, a primary-color glow + dot texture, the XtraPoint × School
// co-brand lockup, and the Anton headline with a Permanent Marker accent word.
//
// satori (JSX-like VDOM → SVG) + @resvg/resvg-js (SVG → PNG). Runs in Node at
// `astro build` only — see src/pages/schools/[school]/og.png.ts. No browser code.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { School } from "@/data/schools";
import { hexToRgba } from "@/data/schools";
import { brand } from "@/config/brand";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const ROOT = process.cwd();
const fontPath = (f: string) => path.join(ROOT, "src/og/fonts", f);
const publicPath = (url: string) => path.join(ROOT, "public", url.replace(/^\//, ""));

// Fonts are read once and cached across schools within a single build.
let fontsCache: Array<{ name: string; data: Buffer; weight: 400 | 700; style: "normal" }> | null =
  null;
const loadFonts = () => {
  if (!fontsCache) {
    fontsCache = [
      { name: "Anton", data: fs.readFileSync(fontPath("Anton-Regular.ttf")), weight: 400, style: "normal" },
      { name: "Permanent Marker", data: fs.readFileSync(fontPath("PermanentMarker-Regular.ttf")), weight: 400, style: "normal" },
      { name: "Space Mono", data: fs.readFileSync(fontPath("SpaceMono-Bold.ttf")), weight: 700, style: "normal" },
    ];
  }
  return fontsCache;
};

/** Read intrinsic pixel dimensions from a PNG's IHDR chunk. */
const pngSize = (buf: Buffer) => ({
  width: buf.readUInt32BE(16),
  height: buf.readUInt32BE(20),
});

interface LogoImage {
  src: string; // data URI
  width: number;
  height: number;
}

/**
 * Load a logo as a data URI sized to `targetHeight` px.
 * - SVG sources are rasterized to PNG via resvg (crisp, keeps aspect ratio).
 * - PNG sources are embedded directly (already raster) with computed width.
 */
const loadLogo = (url: string, targetHeight: number): LogoImage => {
  const abs = publicPath(url);
  if (url.toLowerCase().endsWith(".svg")) {
    const svg = fs.readFileSync(abs, "utf8");
    const r = new Resvg(svg, { fitTo: { mode: "height", value: targetHeight } });
    const png = r.render();
    const buf = png.asPng();
    return {
      src: `data:image/png;base64,${buf.toString("base64")}`,
      width: png.width,
      height: png.height,
    };
  }
  const buf = fs.readFileSync(abs);
  const { width, height } = pngSize(buf);
  return {
    src: `data:image/png;base64,${buf.toString("base64")}`,
    width: Math.round((targetHeight * width) / height),
    height: targetHeight,
  };
};

// Minimal hyperscript for satori's VDOM (avoids needing JSX in a .ts file).
type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, props: Record<string, unknown>, ...children: unknown[]): Node => ({
  type,
  props: { ...props, children: children.length <= 1 ? children[0] : children },
});

export async function renderSchoolOg(school: School): Promise<Buffer> {
  const t = school.theme;
  const xp = loadLogo(brand.logo.white, 44);
  const schoolLogo = loadLogo(school.logo ?? brand.logo.white, 52);

  const logoImg = (img: LogoImage) =>
    h("img", { src: img.src, width: img.width, height: img.height, style: { display: "flex" } });

  // Co-brand school mark — mirror the header's white-badge treatment for
  // colored logos (logoBadge), otherwise render the mono/white logo directly.
  const schoolMark = school.logoBadge
    ? h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            background: "#ffffff",
            borderRadius: 12,
            padding: "10px 14px",
          },
        },
        logoImg(schoolLogo),
      )
    : logoImg(schoolLogo);

  const element = h(
    "div",
    {
      style: {
        width: OG_WIDTH,
        height: OG_HEIGHT,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        background: t.ink,
        padding: "64px 68px",
        fontFamily: "Space Mono",
      },
    },
    // Dot-grid texture (mirrors .dot-grid on the hero).
    h("div", {
      style: {
        position: "absolute",
        inset: 0,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1.5px, transparent 1.5px)",
        backgroundSize: "26px 26px",
      },
    }),
    // Primary-color glow, upper-right (mirrors the hero .glow).
    h("div", {
      style: {
        position: "absolute",
        top: -220,
        right: -160,
        width: 620,
        height: 620,
        borderRadius: 620,
        backgroundImage: `radial-gradient(circle, ${hexToRgba(t.primary, 0.45)} 0%, ${hexToRgba(t.primary, 0)} 65%)`,
      },
    }),

    // ── Top: co-brand lockup ────────────────────────────────────────────────
    h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 20, position: "relative" } },
      logoImg(xp),
      h("span", { style: { color: "rgba(255,255,255,0.3)", fontSize: 34, display: "flex" } }, "×"),
      schoolMark,
    ),

    // ── Middle: pill + headline ─────────────────────────────────────────────
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", position: "relative" } },
      h(
        "div",
        {
          style: {
            display: "flex",
            alignSelf: "flex-start",
            alignItems: "center",
            gap: 10,
            background: t.primarySoft,
            color: t.primary,
            borderRadius: 999,
            padding: "8px 16px",
            fontSize: 18,
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 26,
          },
        },
        h("div", {
          style: { width: 8, height: 8, borderRadius: 8, background: t.primary, display: "flex" },
        }),
        `Launching soon · ${school.short}`,
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            fontFamily: "Anton",
            color: "#ffffff",
            fontSize: 82,
            lineHeight: 1.02,
            textTransform: "uppercase",
            letterSpacing: -1,
          },
        },
        h("span", { style: { display: "flex" } }, "Every purchase, a"),
        h(
          "span",
          {
            style: {
              display: "flex",
              fontFamily: "Permanent Marker",
              fontSize: 84,
              lineHeight: 1,
              color: t.primary,
              textTransform: "none",
              letterSpacing: 0,
              margin: "6px 0",
            },
          },
          "small act of support",
        ),
        h("span", { style: { display: "flex" } }, `for the ${school.mascot}.`),
      ),
    ),

    // ── Bottom: fund line ───────────────────────────────────────────────────
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 12,
          position: "relative",
          color: "rgba(255,255,255,0.6)",
          fontSize: 20,
          textTransform: "uppercase",
          letterSpacing: 1,
        },
      },
      h("span", { style: { display: "flex" } }, `Round-up giving for the ${school.fund}`),
    ),
  );

  const svg = await satori(element as unknown as Parameters<typeof satori>[0], {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: loadFonts(),
  });

  const png = new Resvg(svg, { fitTo: { mode: "width", value: OG_WIDTH } }).render().asPng();
  return png;
}
