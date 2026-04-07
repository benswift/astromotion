interface BgModifiers {
  position?: "left" | "right";
  size?: string;
  splitPercent?: string;
  filters?: string;
}

export function parseHtmlComment(html: string): string | null {
  const trimmed = html.trim();
  if (!trimmed.startsWith("<!--") || !trimmed.endsWith("-->")) return null;
  return trimmed.slice(4, -3).trim();
}

export function parseCommentDirective(
  html: string,
  directive: string,
): string | null {
  const body = parseHtmlComment(html);
  if (!body) return null;
  const prefix = directive + ":";
  if (!body.startsWith(prefix)) return null;
  const value = body.slice(prefix.length).trim();
  return value || null;
}

export function parseClassDirective(html: string): string | null {
  return parseCommentDirective(html, "_class");
}

export function parseNotesDirective(html: string): string | null {
  return parseCommentDirective(html, "notes");
}

export function parseIncludeDirective(html: string): string | null {
  const body = parseHtmlComment(html);
  if (!body) return null;
  if (!body.startsWith("@include ")) return null;
  const path = body.slice("@include ".length).trim().split(/\s/)[0];
  return path || null;
}

export function isHtmlTagStart(html: string, tagName: string): boolean {
  const lower = html.trimStart().toLowerCase();
  if (!lower.startsWith(`<${tagName}`)) return false;
  const charAfterTag = lower[tagName.length + 1];
  return charAfterTag === ">" || charAfterTag === " " || charAfterTag === "\t" || charAfterTag === "\n" || charAfterTag === "/" || charAfterTag === undefined;
}

export function extractScriptContent(raw: string): { attrs: string; body: string } | null {
  const openStart = raw.indexOf("<script");
  if (openStart === -1) return null;
  const openEnd = raw.indexOf(">", openStart);
  if (openEnd === -1) return null;
  const attrs = raw.slice(openStart + "<script".length, openEnd);
  const bodyStart = openEnd + 1;
  const closeIdx = raw.lastIndexOf("</script>");
  if (closeIdx === -1 || closeIdx < bodyStart) return null;
  return { attrs, body: raw.slice(bodyStart, closeIdx) };
}

export function extractFrontmatter(raw: string): { data: string; content: string } | null {
  const open = "---\n";
  if (!raw.startsWith(open)) return null;
  const closeIdx = raw.indexOf("\n---\n", open.length);
  if (closeIdx === -1) {
    if (raw.indexOf("\n---", open.length) === raw.length - 4 && raw.endsWith("\n---")) {
      return { data: raw.slice(open.length, raw.length - 4), content: "" };
    }
    return null;
  }
  return {
    data: raw.slice(open.length, closeIdx),
    content: raw.slice(closeIdx + "\n---\n".length),
  };
}

export function parseBgModifiers(modifiers: string): BgModifiers {
  const result: BgModifiers = {};
  const tokens = modifiers.trim().split(/\s+/).filter(Boolean);
  const filterParts: string[] = [];

  for (const token of tokens) {
    const colonIdx = token.indexOf(":");
    const key = colonIdx === -1 ? token : token.slice(0, colonIdx);
    const value = colonIdx === -1 ? undefined : token.slice(colonIdx + 1);

    if (key === "left" || key === "right") {
      result.position = key;
      result.splitPercent = value || "50%";
    } else if (key === "contain" || key === "cover") {
      result.size = key;
    } else if (key === "blur" || key === "brightness" || key === "saturate") {
      if (value) filterParts.push(`${key}(${value})`);
    }
  }

  if (filterParts.length > 0) result.filters = filterParts.join(" ");
  return result;
}

interface ImgTag {
  before: string;
  src: string;
  after: string;
  start: number;
  end: number;
}

export function findRelativeImgSrcs(html: string): ImgTag[] {
  const results: ImgTag[] = [];
  let searchFrom = 0;

  while (searchFrom < html.length) {
    const imgStart = html.indexOf("<img", searchFrom);
    if (imgStart === -1) break;

    const tagEnd = html.indexOf(">", imgStart);
    if (tagEnd === -1) break;

    const tagContent = html.slice(imgStart, tagEnd + 1);
    const srcMatch = findSrcAttribute(tagContent);
    if (srcMatch && isRelativePath(srcMatch.value)) {
      results.push({
        before: tagContent.slice(4, srcMatch.start),
        src: srcMatch.value,
        after: tagContent.slice(srcMatch.end),
        start: imgStart,
        end: tagEnd + 1,
      });
    }

    searchFrom = tagEnd + 1;
  }

  return results;
}

function findSrcAttribute(tag: string): { value: string; start: number; end: number } | null {
  let i = 0;
  while (i < tag.length) {
    const srcIdx = tag.indexOf("src=", i);
    if (srcIdx === -1) return null;

    if (srcIdx > 0 && /[\w-]/.test(tag[srcIdx - 1])) {
      i = srcIdx + 4;
      continue;
    }

    const afterEquals = srcIdx + 4;
    const quote = tag[afterEquals];
    if (quote === '"' || quote === "'") {
      const closeQuote = tag.indexOf(quote, afterEquals + 1);
      if (closeQuote === -1) return null;
      return {
        value: tag.slice(afterEquals + 1, closeQuote),
        start: srcIdx,
        end: closeQuote + 1,
      };
    }

    const spaceOrEnd = tag.indexOf(" ", afterEquals);
    const end = spaceOrEnd === -1 ? tag.indexOf(">", afterEquals) : Math.min(spaceOrEnd, tag.indexOf(">", afterEquals));
    if (end === -1) return null;
    return {
      value: tag.slice(afterEquals, end),
      start: srcIdx,
      end,
    };
  }
  return null;
}

function isRelativePath(url: string): boolean {
  return url.startsWith("./") || url.startsWith("../");
}
