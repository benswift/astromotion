import type { PreprocessorGroup } from "svelte/compiler";
import type { Root, RootContent, Html } from "mdast";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkRehype from "remark-rehype";
import rehypeShiki from "@shikijs/rehype";
import rehypeStringify from "rehype-stringify";
import { generateLogoSlide } from "./svg/logo-slide.js";
import { generateQrCode } from "./svg/qr-code.js";
import { smartypants } from "smartypants";

const DECK_FILE_PATTERN = /\.deck\.svelte$/;
const INCLUDE_RE = /^<!--\s*@include\s+(\S+)\s*-->$/;
const LOGO_CLASS_RE = /^(anu-logo|socy-logo)$/;
const QR_IMAGE_RE = /!\[qr\]\(([^)]+)\)/g;

const REVEAL_OPTIONS = `{ width: 1280, height: 720, margin: 0, hash: true, hashOneBasedIndex: true, controls: false, navigationMode: "linear", transition: "none", disableLayout: false, viewDistance: 10 }`;

interface BgImage {
  url: string;
  importVar?: string;
  htmlVar?: string;
  position?: "left" | "right";
  size?: string;
  splitPercent?: string;
  filters?: string;
}

const parseProcessor = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter);

async function createHtmlProcessor(codeTheme: string) {
  return unified()
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeShiki, { theme: codeTheme })
    .use(rehypeStringify, { allowDangerousHtml: true });
}

function separateAstNodes(root: Root): {
  scripts: string[];
  styles: string[];
  content: RootContent[];
} {
  const scripts: string[] = [];
  const styles: string[] = [];
  const content: RootContent[] = [];

  for (const node of root.children) {
    if (node.type === "yaml") continue;
    if (node.type === "html") {
      const val = (node as Html).value;
      if (/^<script[\s>]/i.test(val)) {
        scripts.push(val);
        continue;
      }
      if (/^<style[\s>]/i.test(val)) {
        styles.push(val);
        continue;
      }
    }
    content.push(node);
  }

  return { scripts, styles, content };
}

function parseBgModifiers(modifiers: string): Omit<BgImage, "url"> {
  const trimmed = modifiers.trim();
  const result: Omit<BgImage, "url"> = {};

  const leftMatch = trimmed.match(/\bleft(?::(\d+%))?/);
  if (leftMatch) {
    result.position = "left";
    result.splitPercent = leftMatch[1] || "50%";
  }

  const rightMatch = trimmed.match(/\bright(?::(\d+%))?/);
  if (rightMatch) {
    result.position = "right";
    result.splitPercent = rightMatch[1] || "50%";
  }

  if (/\bcontain\b/.test(trimmed)) {
    result.size = "contain";
  } else if (/\bcover\b/.test(trimmed)) {
    result.size = "cover";
  }

  const filterParts: string[] = [];
  const blurMatch = trimmed.match(/blur:(\S+)/);
  if (blurMatch) filterParts.push(`blur(${blurMatch[1]})`);
  const brightnessMatch = trimmed.match(/brightness:(\S+)/);
  if (brightnessMatch) filterParts.push(`brightness(${brightnessMatch[1]})`);
  const saturateMatch = trimmed.match(/saturate:(\S+)/);
  if (saturateMatch) filterParts.push(`saturate(${saturateMatch[1]})`);
  if (filterParts.length > 0) result.filters = filterParts.join(" ");

  return result;
}

function resolveIncludes(root: Root, dir: string): void {
  const children = root.children;
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (node.type !== "html") continue;
    const match = (node as Html).value.match(INCLUDE_RE);
    if (!match) continue;
    const includePath = resolve(dir, match[1]);
    const includeContent = readFileSync(includePath, "utf-8");
    const included = parseProcessor.parse(includeContent);
    children.splice(i, 1, ...included.children);
    i += included.children.length - 1;
  }
}

function splitAtThematicBreaks(nodes: RootContent[]): RootContent[][] {
  const groups: RootContent[][] = [];
  let current: RootContent[] = [];

  for (const node of nodes) {
    if (node.type === "thematicBreak") {
      groups.push(current);
      current = [];
    } else {
      current.push(node);
    }
  }
  groups.push(current);

  return groups;
}

function extractMetadataNodes(nodes: RootContent[]): {
  slideClass: string | null;
  notesContent: string | null;
  remaining: RootContent[];
} {
  let slideClass: string | null = null;
  let notesContent: string | null = null;
  const remaining: RootContent[] = [];

  for (const node of nodes) {
    if (node.type === "html") {
      const classMatch = (node as Html).value.match(/<!--\s*_class:\s*([\w\s-]+?)\s*-->/);
      if (classMatch) {
        slideClass = classMatch[1].trim();
        continue;
      }
      const notesMatch = (node as Html).value.match(/<!--\s*notes:\s*([\s\S]*?)\s*-->/);
      if (notesMatch) {
        notesContent = notesMatch[1].trim();
        continue;
      }
    }
    remaining.push(node);
  }

  return { slideClass, notesContent, remaining };
}

export function extractBgImagesFromAst(nodes: RootContent[]): {
  images: BgImage[];
  remaining: RootContent[];
} {
  const images: BgImage[] = [];
  const remaining: RootContent[] = [];

  for (const node of nodes) {
    if (node.type === "paragraph" && node.children.length === 1) {
      const child = node.children[0];
      if (child.type === "image" && child.alt?.startsWith("bg")) {
        const modifiers = child.alt!.slice(2);
        images.push({ url: child.url, ...parseBgModifiers(modifiers) });
        continue;
      }
    }
    remaining.push(node);
  }

  return { images, remaining };
}

export function replaceQrImagesInAst(nodes: RootContent[]): RootContent[] {
  return nodes.map((node) => {
    if (node.type === "paragraph" && node.children.length === 1) {
      const child = node.children[0];
      if (child.type === "image" && child.alt === "qr") {
        return { type: "html", value: generateQrCode(child.url) } as Html;
      }
    }
    return node;
  });
}

async function astToHtml(nodes: RootContent[], processor: any): Promise<string> {
  const root: Root = { type: "root", children: nodes };
  const hast = await processor.run(root);
  return processor.stringify(hast) as string;
}

function sliceNodesText(nodes: RootContent[], text: string): string {
  return nodes
    .filter((n) => n.position)
    .map((n) => text.slice(n.position!.start.offset, n.position!.end.offset))
    .join("\n\n");
}

function buildSlideAttrs(slideClass: string | null): string {
  if (slideClass) {
    return ` class="${slideClass}"`;
  }
  return "";
}

function buildBgDiv(images: BgImage[]): string {
  const fullBleed = images.find((img) => !img.position);
  if (!fullBleed) return "";

  const size = fullBleed.size || "cover";

  if (fullBleed.htmlVar) {
    return `{@html ${fullBleed.htmlVar}}`;
  }

  const styleParts = [
    `background-image: url('${fullBleed.url}')`,
    `background-size: ${size}`,
    "background-position: center",
  ];
  if (fullBleed.filters) {
    styleParts.push(`filter: ${fullBleed.filters}`);
  }
  return `<div class="slide-bg" style="${styleParts.join("; ")}"></div>`;
}

function buildSplitWrapper(images: BgImage[], innerHtml: string): string {
  const splitImage = images.find((img) => img.position);
  if (!splitImage) return innerHtml;

  const imagePercent = splitImage.splitPercent || "50%";
  const contentPercent = `calc(100% - ${imagePercent})`;
  const filterPart = splitImage.filters
    ? `; filter: ${splitImage.filters}`
    : "";

  const imageDiv = splitImage.htmlVar
    ? `{@html ${splitImage.htmlVar}}`
    : `<div class="split-image" style="background-image: url('${splitImage.url}'); width: ${imagePercent}${filterPart}"></div>`;
  const contentDiv = `<div class="split-content" style="width: ${contentPercent}">${innerHtml}</div>`;

  if (splitImage.position === "left") {
    return `<div class="split-layout">${imageDiv}${contentDiv}</div>`;
  }
  return `<div class="split-layout">${contentDiv}${imageDiv}</div>`;
}

function buildScriptBlock(
  userScripts: string[],
  imageImports: Map<string, string>,
  bgHtmlDecls: string[],
): string {
  let scriptAttrs = ' lang="ts"';
  let userBody = "";

  if (userScripts.length > 0) {
    const raw = userScripts.join("\n");
    const tagMatch = raw.match(/^<script([^>]*)>/i);
    if (tagMatch) scriptAttrs = tagMatch[1];
    const bodyMatch = raw.match(/^<script[^>]*>([\s\S]*)<\/script>\s*$/i);
    if (bodyMatch) userBody = bodyMatch[1];
  }

  const lines: string[] = [];
  lines.push(`<script${scriptAttrs}>`);
  lines.push(`  import Reveal from "reveal.js";`);
  lines.push(`  import { onMount } from "svelte";`);

  for (const [url, varName] of imageImports) {
    const importPath = url.startsWith("./") || url.startsWith("../") ? url : `./${url}`;
    lines.push(`  import ${varName} from '${importPath}';`);
  }

  if (userBody.trim()) {
    lines.push(userBody.trimEnd());
  }

  lines.push("");
  lines.push("  let revealEl: HTMLDivElement;");
  lines.push("  onMount(() => {");
  lines.push(`    const deck = new Reveal(revealEl, ${REVEAL_OPTIONS});`);
  lines.push("    deck.initialize();");
  lines.push("    return () => deck.destroy();");
  lines.push("  });");

  for (const decl of bgHtmlDecls) {
    lines.push(`  ${decl}`);
  }

  lines.push("</script>");
  return lines.join("\n");
}

interface DeckPreprocessorOptions {
  codeTheme?: string;
}

export function deckPreprocessor(options: DeckPreprocessorOptions = {}): PreprocessorGroup {
  const codeTheme = options.codeTheme ?? "vitesse-dark";
  let htmlProcessor: any = null;

  return {
    name: "deck-preprocessor",
    async markup({ content, filename }) {
      if (!filename || !DECK_FILE_PATTERN.test(filename)) {
        return undefined;
      }

      if (!htmlProcessor) {
        htmlProcessor = await createHtmlProcessor(codeTheme);
      }

      const root = parseProcessor.parse(content);
      resolveIncludes(root, dirname(filename));
      const { scripts, styles, content: contentNodes } = separateAstNodes(root);

      if (contentNodes.length === 0) {
        return undefined;
      }

      const groups = splitAtThematicBreaks(contentNodes);
      const slideOutputs: string[] = [];
      const imageImportMap = new Map<string, string>();
      const bgHtmlDecls: string[] = [];
      let imgCounter = 0;
      let bgHtmlCounter = 0;

      for (const group of groups) {
        if (group.length === 0) continue;

        const { slideClass, notesContent, remaining: afterMeta } = extractMetadataNodes(group);

        const logoMatch = slideClass?.match(LOGO_CLASS_RE);
        if (logoMatch) {
          const variant = logoMatch[1] === "anu-logo" ? "anu" as const : "socy" as const;
          const logoSvg = generateLogoSlide(variant);
          const slideAttrs = buildSlideAttrs(slideClass);
          const notesTag = notesContent
            ? `\n    <div class="notes">${notesContent}</div>`
            : "";
          slideOutputs.push(
            `  <section${slideAttrs}>\n    ${logoSvg}${notesTag}\n  </section>`,
          );
          continue;
        }

        const { images, remaining: afterBg } = extractBgImagesFromAst(afterMeta);

        for (const img of images) {
          if (!img.url.startsWith("/") && !/^https?:\/\//.test(img.url)) {
            if (!imageImportMap.has(img.url)) {
              imageImportMap.set(img.url, `__deckImg${imgCounter++}`);
            }
            img.importVar = imageImportMap.get(img.url);

            const htmlVarName = `__bgHtml${bgHtmlCounter++}`;
            img.htmlVar = htmlVarName;

            const size = img.size || "cover";
            const filterCss = img.filters ? `; filter: ${img.filters}` : "";
            const imgSrc = `(typeof ${img.importVar} === 'string' ? ${img.importVar} : ${img.importVar}.src)`;
            if (img.position) {
              const percent = img.splitPercent || "50%";
              bgHtmlDecls.push(
                `const ${htmlVarName} = '<div class="split-image" style="background-image: url(' + ${imgSrc} + '); width: ${percent}${filterCss}"></div>';`,
              );
            } else {
              bgHtmlDecls.push(
                `const ${htmlVarName} = '<div class="slide-bg" style="background-image: url(' + ${imgSrc} + '); background-size: ${size}; background-position: center${filterCss}"></div>';`,
              );
            }
          }
        }

        const afterQr = replaceQrImagesInAst(afterBg);
        let innerHtml = await astToHtml(afterQr, htmlProcessor);

        innerHtml = innerHtml.replace(
          /<img\b([^>]*?)\bsrc=["'](\.\.?\/[^"']+)["']([^>]*?)>/g,
          (_match, before, url, after) => {
            if (!imageImportMap.has(url)) {
              imageImportMap.set(url, `__deckImg${imgCounter++}`);
            }
            const varName = imageImportMap.get(url)!;
            const srcExpr = `{typeof ${varName} === 'string' ? ${varName} : ${varName}.src}`;
            return `<img${before}src=${srcExpr}${after}>`;
          },
        );

        innerHtml = smartypants(innerHtml, "2");
        innerHtml = buildSplitWrapper(images, innerHtml);

        const slideAttrs = buildSlideAttrs(slideClass);
        const bgDiv = buildBgDiv(images);
        const notesTag = notesContent
          ? `\n    <div class="notes">${notesContent}</div>`
          : "";

        slideOutputs.push(
          `  <section${slideAttrs}>\n    ${bgDiv}${innerHtml}${notesTag}\n  </section>`,
        );
      }

      const scriptBlock = buildScriptBlock(scripts, imageImportMap, bgHtmlDecls);
      const slidesContent = slideOutputs.join("\n\n");
      const styleBlock = styles.length > 0 ? "\n" + styles.join("\n") : "";

      const code = `${scriptBlock}\n\n<div class="reveal" bind:this={revealEl}>\n  <div class="slides">\n${slidesContent}\n  </div>\n</div>${styleBlock}\n`;

      return { code };
    },
  };
}
