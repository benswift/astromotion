import type { Root } from "mdast";
import { readFileSync } from "node:fs";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdx from "remark-mdx";
import { parseIncludeDirectiveMdx, resolveIncludePath } from "../src/parse-helpers.ts";

const MAX_DEPTH = 10;

const mdxParseProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkFrontmatter)
  .use(remarkMdx);

// Included content is parsed from a *different* source file, so its node
// positions point into that file --- meaningless (and misleading) once spliced
// into the deck's vfile. Drop them so downstream plugins can treat "has a
// position" as "came from the deck's own source" --- e.g. remarkDeckBg re-reads
// an image's raw alt from file.value for genuine inline images only.
function stripPositions(node: { position?: unknown; children?: unknown[] }): void {
  delete node.position;
  const children = node.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      stripPositions(child as { position?: unknown; children?: unknown[] });
    }
  }
}

function resolveIncludesIn(root: Root, fromFile: string, depth: number): void {
  if (depth > MAX_DEPTH) return;
  for (let i = root.children.length - 1; i >= 0; i--) {
    const node = root.children[i];
    if ((node as any).type !== "mdxFlowExpression") continue;
    const includePath = parseIncludeDirectiveMdx((node as any).value);
    if (!includePath) continue;
    if (!includePath.endsWith(".mdx")) {
      throw new Error(
        `@include only supports .mdx files, got: ${includePath}. Rename the file to .mdx.`,
      );
    }
    const absPath = resolveIncludePath(includePath, fromFile);
    const content = readFileSync(absPath, "utf-8");
    const includeRoot = mdxParseProcessor.parse(content);
    resolveIncludesIn(includeRoot, absPath, depth + 1);
    const contentNodes = includeRoot.children.filter((n) => !["yaml", "toml"].includes(n.type));
    for (const contentNode of contentNodes) stripPositions(contentNode);
    root.children.splice(i, 1, ...contentNodes);
  }
}

export function remarkDeckIncludes() {
  return (tree: Root, file: { path?: string }) => {
    if (!file.path?.endsWith(".deck.mdx")) return;
    resolveIncludesIn(tree, file.path, 0);
  };
}
