import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGOS_DIR = resolve(__dirname, "../../assets");

const svgCache = new Map<string, string>();

function readSvg(filename: string): string {
  const cached = svgCache.get(filename);
  if (cached) return cached;
  const content = readFileSync(resolve(LOGOS_DIR, filename), "utf-8");
  svgCache.set(filename, content);
  return content;
}

function extractSvgInner(raw: string): string {
  return raw.replace(/<\?xml[^?]*\?>\s*/, "").replace(/<\/?svg[^>]*>/g, "");
}

function prefixClasses(content: string, prefix: string): string {
  return content.replace(/cls-/g, `${prefix}-cls-`);
}

function vruleRects(x: number, gapTop = 250, gapBottom = 470): string {
  return [
    `<rect class="logo-rule-top" x="${x}" y="0" width="1" height="${gapTop}" fill="#be830e" style="transform-origin: ${x}px 0px"/>`,
    `<rect class="logo-rule-bottom" x="${x}" y="${gapBottom}" width="1" height="${720 - gapBottom}" fill="#be830e" style="transform-origin: ${x}px 720px"/>`,
  ].join("\n    ");
}

export function generateLogoSlide(variant: "anu" | "socy"): string {
  let inner: string;
  let vrules: string;
  let logoTransform: string;

  if (variant === "anu") {
    const raw = readSvg("ANU_Primary_Horizontal_GoldWhite.svg");
    inner = prefixClasses(extractSvgInner(raw), "anu");
    vrules = vruleRects(320);
    logoTransform = "translate(230, 287) scale(2)";
  } else {
    const raw = readSvg("SCyb_Horizontal_GoldWhite.svg");
    inner = prefixClasses(extractSvgInner(raw), "socy");
    const logoScale = 1.5;
    const logoWidth = 425.28 * logoScale;
    const logoHeight = 110.16 * logoScale;
    const logoX = (1280 - logoWidth) / 2;
    const logoY = (720 - logoHeight) / 2;
    vrules = vruleRects(logoX + 53 * logoScale - 8);
    logoTransform = `translate(${logoX}, ${logoY}) scale(${logoScale})`;
  }

  return `<svg viewBox="0 0 1280 720" class="logo-svg" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    ${vrules}
    <g class="logo-group" transform="${logoTransform}">
      ${inner}
    </g>
  </svg>`;
}
