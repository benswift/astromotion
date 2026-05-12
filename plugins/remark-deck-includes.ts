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
    root.children.splice(i, 1, ...includeRoot.children);
  }
}

export function remarkDeckIncludes() {
  return (tree: Root, file: { path?: string }) => {
    if (!file.path?.endsWith(".deck.mdx")) return;
    resolveIncludesIn(tree, file.path, 0);
  };
}
