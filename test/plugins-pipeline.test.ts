import { describe, it, expect } from "vitest";
import type { Root } from "mdast";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkSmartypants from "remark-smartypants";
import { deckRemarkPlugins } from "../plugins/index.ts";

async function runPipeline(input: string, filePath: string): Promise<Root> {
  const processor = unified().use(remarkParse).use(remarkMdx).use(deckRemarkPlugins);
  const tree = processor.parse(input);
  await processor.run(tree, { path: filePath });
  return tree as Root;
}

function collectText(tree: Root): string[] {
  const out: string[] = [];
  function walk(node: any): void {
    if (node?.type === "text" && typeof node.value === "string") out.push(node.value);
    if (Array.isArray(node?.children)) for (const c of node.children) walk(c);
  }
  walk(tree);
  return out;
}

function classOf(node: any): string | undefined {
  return node?.attributes?.find((a: any) => a.name === "class")?.value;
}

function findChild(parent: any, predicate: (n: any) => boolean): any {
  return (parent.children as any[]).find(predicate);
}

describe("deck plugin pipeline", () => {
  it("turns a multi-slide deck with all directives into expected AST", async () => {
    const input = `{/* _class: banner */}

# Title

![bg](./bg.jpg)

---

{/* _class: impact */}

**activity**

---

## Heading

![bg right:40%](./side.jpg)

body
`;
    const tree = await runPipeline(input, "/decks/foo.deck.mdx");
    expect(tree.children.length).toBe(3);
    const [s1, s2, s3] = tree.children as any[];

    // Slide 1: section with class banner, includes a slide-bg div child
    expect(s1.type).toBe("mdxJsxFlowElement");
    expect(s1.name).toBe("section");
    expect(classOf(s1)).toBe("banner");
    const slideBg = findChild(
      s1,
      (n) => n.type === "mdxJsxFlowElement" && classOf(n) === "slide-bg",
    );
    expect(slideBg).toBeDefined();

    // Slide 2: section with class impact
    expect(classOf(s2)).toBe("impact");

    // Slide 3: section contains a split-layout wrapper
    const splitLayout = findChild(
      s3,
      (n) => n.type === "mdxJsxFlowElement" && classOf(n) === "split-layout",
    );
    expect(splitLayout).toBeDefined();
    const splitImage = findChild(splitLayout, (n) => classOf(n) === "split-image");
    const splitContent = findChild(splitLayout, (n) => classOf(n) === "split-content");
    expect(splitImage).toBeDefined();
    expect(splitContent).toBeDefined();
  });

  it("applies oldschool smartypants to included content even when Astro registers smartypants first", async () => {
    // Reproduces the bug where unified deduplicates remark-smartypants by
    // reference: when @astrojs/mdx registers it ahead of user plugins, a
    // second .use(remarkSmartypants, ...) just merges options into the first
    // registration and runs before remarkDeckIncludes splices in @include
    // content -- so prose dashes inside includes never become em dashes.
    const dir = mkdtempSync(join(tmpdir(), "astromotion-smarty-"));
    writeFileSync(join(dir, "partial.mdx"), "that's it---the spread is your model\n");
    const input = `intro---one

---

{/* @include ./partial.mdx */}
`;
    const processor = unified()
      .use(remarkParse)
      .use(remarkMdx)
      .use(remarkSmartypants) // simulate @astrojs/mdx default
      .use(deckRemarkPlugins);
    const tree = processor.parse(input) as Root;
    await processor.run(tree, { path: join(dir, "deck.deck.mdx") });
    const texts = collectText(tree);
    expect(texts.some((t) => t.includes("---"))).toBe(false);
    expect(texts.some((t) => t.includes("intro—one"))).toBe(true);
    expect(texts.some((t) => t.includes("that’s it—the spread"))).toBe(true);
  });
});
