import type { Plugin } from "vite";
import type { Root, RootContent, Html, Image } from "mdast";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkRehype from "remark-rehype";
import rehypeShiki from "@shikijs/rehype";
import rehypeStringify from "rehype-stringify";
import { generateQrCode } from "./svg/qr-code.js";
import { smartypants } from "smartypants";
import { parseDeckFrontmatter } from "./meta.js";
import {
  parseClassDirective,
  parseNotesDirective,
  parseIncludeDirective,
  isHtmlTagStart,
  parseBgModifiers,
} from "./parse-helpers.js";

type PreprocessFn = (markdown: string, filePath: string) => string | Promise<string>;

let globalPreprocess: PreprocessFn | undefined;

export function setGlobalPreprocess(fn: PreprocessFn): void {
  globalPreprocess = fn;
}

const DECK_FILE_PATTERN = /\.deck\.md$/;

interface BgImage {
  url: string;
  importVar?: string;
  position?: "left" | "right";
  size?: string;
  splitPercent?: string;
  filters?: string;
}

const parseProcessor = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter);

function separateAstNodes(root: Root, { extractStyles = true } = {}) {
  const styles: string[] = [];
  const content: RootContent[] = [];

  for (const node of root.children) {
    if (node.type === "yaml") continue;
    if (node.type === "html") {
      const val = (node as Html).value;
      if (isHtmlTagStart(val, "script")) continue;
      if (extractStyles && isHtmlTagStart(val, "style")) {
        styles.push(val);
        continue;
      }
    }
    content.push(node);
  }

  return { styles, content };
}

function resolveIncludes(root: Root, dir: string, depth = 0): void {
  if (depth > 10) return;

  for (let i = root.children.length - 1; i >= 0; i--) {
    const node = root.children[i];
    if (node.type !== "html") continue;
    const path = parseIncludeDirective((node as Html).value);
    if (!path) continue;

    const includePath = resolve(dir, path);
    const content = readFileSync(includePath, "utf-8");
    const includeRoot = parseProcessor.parse(content);
    resolveIncludes(includeRoot, dirname(includePath), depth + 1);
    root.children.splice(i, 1, ...includeRoot.children);
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

function extractMetadataNodes(nodes: RootContent[]) {
  let slideClass: string | null = null;
  let notesContent: string | null = null;
  const remaining: RootContent[] = [];

  for (const node of nodes) {
    if (node.type === "html") {
      const cls = parseClassDirective((node as Html).value);
      if (cls !== null) {
        slideClass = cls;
        continue;
      }
      const notes = parseNotesDirective((node as Html).value);
      if (notes !== null) {
        notesContent = notes;
        continue;
      }
    }
    remaining.push(node);
  }

  return { slideClass, notesContent, remaining };
}

export function extractBgImagesFromAst(nodes: RootContent[]) {
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
        return { type: "html", value: generateQrCode(child.url) } as any;
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

function isRelativeUrl(url: string): boolean {
  return url.startsWith("./") || url.startsWith("../");
}

function imgSrcExpr(varName: string): string {
  return `(typeof ${varName} === 'string' ? ${varName} : ${varName}.src)`;
}

function escapeForJs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\r?\n/g, "\\n");
}

// A "segment" is either a static string or a JS expression to be concatenated.
type Segment = { type: "static"; value: string } | { type: "expr"; value: string };

function segmentsToJs(segments: Segment[]): string {
  if (segments.length === 0) return "''";

  const parts: string[] = [];
  for (const seg of segments) {
    if (seg.type === "static") {
      if (seg.value.length > 0) {
        parts.push(`'${escapeForJs(seg.value)}'`);
      }
    } else {
      parts.push(seg.value);
    }
  }
  return parts.join(" + ") || "''";
}

function buildBgSegments(images: BgImage[], _imageImportMap: Map<string, string>): Segment[] {
  const fullBleed = images.find((img) => !img.position);
  if (!fullBleed) return [];

  const size = fullBleed.size || "cover";

  if (fullBleed.importVar) {
    const styleParts = [`background-size: ${size}`, "background-position: center"];
    if (fullBleed.filters) {
      styleParts.push(`filter: ${fullBleed.filters}`);
    }
    return [
      { type: "static", value: `<div class="slide-bg" style="background-image: url(` },
      { type: "expr", value: imgSrcExpr(fullBleed.importVar) },
      { type: "static", value: `); ${styleParts.join("; ")}"></div>` },
    ];
  }

  const styleParts = [
    `background-image: url('${fullBleed.url}')`,
    `background-size: ${size}`,
    "background-position: center",
  ];
  if (fullBleed.filters) {
    styleParts.push(`filter: ${fullBleed.filters}`);
  }
  return [
    { type: "static", value: `<div class="slide-bg" style="${styleParts.join("; ")}"></div>` },
  ];
}

function buildSplitSegments(images: BgImage[], innerSegments: Segment[]): Segment[] {
  const splitImage = images.find((img) => img.position);
  if (!splitImage) return innerSegments;

  const imagePercent = splitImage.splitPercent || "50%";
  const contentPercent = `calc(100% - ${imagePercent})`;
  const filterPart = splitImage.filters ? `; filter: ${splitImage.filters}` : "";

  let imageSegments: Segment[];
  if (splitImage.importVar) {
    imageSegments = [
      { type: "static", value: `<div class="split-image" style="background-image: url(` },
      { type: "expr", value: imgSrcExpr(splitImage.importVar) },
      { type: "static", value: `); width: ${imagePercent}${filterPart}"></div>` },
    ];
  } else {
    imageSegments = [
      {
        type: "static",
        value: `<div class="split-image" style="background-image: url('${splitImage.url}'); width: ${imagePercent}${filterPart}"></div>`,
      },
    ];
  }

  const contentSegments: Segment[] = [
    { type: "static", value: `<div class="split-content" style="width: ${contentPercent}">` },
    ...innerSegments,
    { type: "static", value: `</div>` },
  ];

  if (splitImage.position === "left") {
    return [
      { type: "static", value: `<div class="split-layout">` },
      ...imageSegments,
      ...contentSegments,
      { type: "static", value: `</div>` },
    ];
  }
  return [
    { type: "static", value: `<div class="split-layout">` },
    ...contentSegments,
    ...imageSegments,
    { type: "static", value: `</div>` },
  ];
}

interface DeckPluginOptions {
  codeTheme?: string | Record<string, unknown>;
  preprocess?: (markdown: string, filePath: string) => string | Promise<string>;
  /** Base path for resolved asset URLs in static HTML output (e.g. "/comp1720"). Not needed for the Vite plugin path where imports handle resolution. */
  base?: string;
}

export function deckPlugin(options: DeckPluginOptions = {}): Plugin {
  const codeTheme = options.codeTheme ?? "vitesse-dark";
  let htmlProcessor: any = null;

  return {
    name: "astromotion-deck",
    enforce: "pre",
    resolveId(id) {
      if (DECK_FILE_PATTERN.test(id)) {
        return id;
      }
    },
    async load(id) {
      if (!DECK_FILE_PATTERN.test(id)) return null;

      if (!htmlProcessor) {
        htmlProcessor = await createHtmlProcessor(codeTheme);
      }

      let code = readFileSync(id, "utf-8");
      if (options.preprocess) {
        code = await options.preprocess(code, id);
      }
      const { data: frontmatter } = parseDeckFrontmatter(code);
      const root = parseProcessor.parse(code);
      resolveIncludes(root, dirname(id));
      const { content: contentNodes } = separateAstNodes(root, { extractStyles: false });

      if (contentNodes.length === 0) return null;

      const groups = splitAtThematicBreaks(contentNodes);
      const slideExprs: string[] = [];
      const imageImportMap = new Map<string, string>();
      const imgCounter = { value: 0 };

      for (const group of groups) {
        if (group.length === 0) continue;

        const { slideClass, notesContent, remaining: afterMeta } = extractMetadataNodes(group);

        const { images, remaining: afterBg } = extractBgImagesFromAst(afterMeta);

        for (const img of images) {
          if (isRelativeUrl(img.url)) {
            if (!imageImportMap.has(img.url)) {
              imageImportMap.set(img.url, `__deckImg${imgCounter.value++}`);
            }
            img.importVar = imageImportMap.get(img.url);
          }
        }

        const afterQr = replaceQrImagesInAst(afterBg);
        collectAstImageImports(afterQr, imageImportMap, imgCounter);
        let innerHtml = await astToHtml(afterQr, htmlProcessor);
        innerHtml = smartypants(innerHtml, "2");

        const contentSegments = htmlToSegments(innerHtml);

        const wrappedSegments = buildSplitSegments(images, contentSegments);
        const bgSegments = buildBgSegments(images, imageImportMap);
        const slideAttrs = buildSlideAttrs(slideClass);
        const notesTag = notesContent ? `<div class="notes">${notesContent}</div>` : "";

        const allSegments: Segment[] = [
          { type: "static", value: `<section${slideAttrs}>` },
          ...bgSegments,
          ...wrappedSegments,
          { type: "static", value: notesTag },
          { type: "static", value: `</section>` },
        ];

        slideExprs.push(segmentsToJs(allSegments));
      }

      const importLines: string[] = [];
      for (const [url, varName] of imageImportMap) {
        const importPath = url.startsWith("./") || url.startsWith("../") ? url : `./${url}`;
        importLines.push(`import ${varName} from '${importPath}';`);
      }

      const slidesExpr = slideExprs.join(" + ");

      const output = [
        ...importLines,
        `export const frontmatter = ${JSON.stringify(frontmatter)};`,
        `const slides = ${slidesExpr};`,
        "export default slides;",
      ]
        .filter(Boolean)
        .join("\n");

      return { code: output, map: null };
    },
  };
}

async function createHtmlProcessor(codeTheme: string | Record<string, unknown>) {
  const shikiOptions = typeof codeTheme === "string" ? { theme: codeTheme } : codeTheme;
  return unified()
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeShiki, shikiOptions as any)
    .use(rehypeStringify, { allowDangerousHtml: true });
}

function buildSlideAttrs(slideClass: string | null): string {
  if (slideClass) return ` class="${slideClass}"`;
  return "";
}

function resolveImageUrl(url: string, deckDir: string, base = ""): string {
  if (!isRelativeUrl(url)) return url;
  const absolute = resolve(deckDir, url);
  const root = resolve(".");
  return base + "/" + relative(root, absolute);
}

/** Walk mdast nodes and resolve relative image URLs in-place (for static HTML output). */
function resolveAstImageUrls(nodes: RootContent[], deckDir: string, base = ""): void {
  for (const node of nodes) {
    if (node.type === "image" && isRelativeUrl((node as Image).url)) {
      (node as Image).url = resolveImageUrl((node as Image).url, deckDir, base);
    }
    if ("children" in node) {
      resolveAstImageUrls((node as any).children, deckDir, base);
    }
  }
}

const IMPORT_TOKEN_RE = /__DECK_IMPORT_(\w+)__/g;

/** Walk mdast nodes, collect relative image URLs into the import map, and replace with placeholder tokens (for Vite output). */
function collectAstImageImports(
  nodes: RootContent[],
  imageImportMap: Map<string, string>,
  imgCounter: { value: number },
): void {
  for (const node of nodes) {
    if (node.type === "image" && isRelativeUrl((node as Image).url)) {
      const url = (node as Image).url;
      if (!imageImportMap.has(url)) {
        imageImportMap.set(url, `__deckImg${imgCounter.value++}`);
      }
      (node as Image).url = `__DECK_IMPORT_${imageImportMap.get(url)}__`;
    }
    if ("children" in node) {
      collectAstImageImports((node as any).children, imageImportMap, imgCounter);
    }
  }
}

/** Split an HTML string on import placeholder tokens into static/expr segments. */
function htmlToSegments(html: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of html.matchAll(IMPORT_TOKEN_RE)) {
    if (match.index > lastIndex) {
      segments.push({ type: "static", value: html.slice(lastIndex, match.index) });
    }
    segments.push({ type: "expr", value: imgSrcExpr(match[1]) });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < html.length) {
    segments.push({ type: "static", value: html.slice(lastIndex) });
  }

  return segments;
}

export async function processDeckMarkdown(
  code: string,
  filePath: string,
  options: DeckPluginOptions = {},
): Promise<string> {
  const codeTheme = options.codeTheme ?? "vitesse-dark";
  const base = options.base ?? "";
  const htmlProcessor = await createHtmlProcessor(codeTheme);
  const deckDir = dirname(filePath);

  const preprocess = options.preprocess ?? globalPreprocess;
  if (preprocess) {
    code = await preprocess(code, filePath);
  }
  const root = parseProcessor.parse(code);
  resolveIncludes(root, deckDir);
  const { content: contentNodes } = separateAstNodes(root, { extractStyles: false });

  if (contentNodes.length === 0) return "";

  const groups = splitAtThematicBreaks(contentNodes);
  const slideOutputs: string[] = [];

  for (const group of groups) {
    if (group.length === 0) continue;

    const { slideClass, notesContent, remaining: afterMeta } = extractMetadataNodes(group);

    const { images, remaining: afterBg } = extractBgImagesFromAst(afterMeta);

    const afterQr = replaceQrImagesInAst(afterBg);
    resolveAstImageUrls(afterQr, deckDir, base);
    let innerHtml = await astToHtml(afterQr, htmlProcessor);
    innerHtml = smartypants(innerHtml, "2");

    const fullBleed = images.find((img) => !img.position);
    let bgDiv = "";
    if (fullBleed) {
      const size = fullBleed.size || "cover";
      const resolved = resolveImageUrl(fullBleed.url, deckDir, base);
      const styleParts = [
        `background-image: url('${resolved}')`,
        `background-size: ${size}`,
        "background-position: center",
      ];
      if (fullBleed.filters) styleParts.push(`filter: ${fullBleed.filters}`);
      bgDiv = `<div class="slide-bg" style="${styleParts.join("; ")}"></div>`;
    }

    const splitImage = images.find((img) => img.position);
    if (splitImage) {
      const imagePercent = splitImage.splitPercent || "50%";
      const contentPercent = `calc(100% - ${imagePercent})`;
      const filterPart = splitImage.filters ? `; filter: ${splitImage.filters}` : "";
      const resolved = resolveImageUrl(splitImage.url, deckDir, base);
      const imageDiv = `<div class="split-image" style="background-image: url('${resolved}'); width: ${imagePercent}${filterPart}"></div>`;
      const contentDiv = `<div class="split-content" style="width: ${contentPercent}">${innerHtml}</div>`;
      innerHtml =
        splitImage.position === "left"
          ? `<div class="split-layout">${imageDiv}${contentDiv}</div>`
          : `<div class="split-layout">${contentDiv}${imageDiv}</div>`;
    }

    const slideAttrs = buildSlideAttrs(slideClass);
    const notesTag = notesContent ? `<div class="notes">${notesContent}</div>` : "";

    slideOutputs.push(`<section${slideAttrs}>${bgDiv}${innerHtml}${notesTag}</section>`);
  }

  return slideOutputs.join("\n");
}

export function collectDeckAssets(decksDir: string): string[] {
  const assets: string[] = [];

  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (!/\.deck\.(md|svx|svelte)$/.test(entry.name) && !entry.name.endsWith(".css")) {
        assets.push(full);
      }
    }
  }

  walk(decksDir);
  return assets;
}
