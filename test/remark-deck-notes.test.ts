import { describe, it, expect } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { remarkDeckSections } from "../plugins/remark-deck-sections.ts";
import { remarkDeckNotes } from "../plugins/remark-deck-notes.ts";

describe("remarkDeckNotes", () => {
  it("appends a notes <div> to the section and removes the directive", async () => {
    const input = "# Title\n\n<!-- notes:\nspeaker note text\n-->\n\nbody\n";
    const tree = unified().use(remarkParse).parse(input);
    await unified()
      .use(remarkDeckSections)
      .use(remarkDeckNotes)
      .run(tree, { path: "test.deck.mdx" });
    const section = tree.children[0] as any;
    const notesEl = section.children.find(
      (c: any) => c.type === "mdxJsxFlowElement" && c.name === "div",
    );
    expect(notesEl).toBeDefined();
    expect(notesEl.attributes.some((a: any) => a.name === "class" && a.value === "notes")).toBe(
      true,
    );
    const htmlNodes = section.children.filter(
      (c: any) => c.type === "html" && c.value.includes("notes:"),
    );
    expect(htmlNodes.length).toBe(0);
  });

  it("does nothing when no notes directive is present", async () => {
    const input = "# Title\n\nbody\n";
    const tree = unified().use(remarkParse).parse(input);
    await unified()
      .use(remarkDeckSections)
      .use(remarkDeckNotes)
      .run(tree, { path: "test.deck.mdx" });
    const section = tree.children[0] as any;
    const notesEl = section.children.find(
      (c: any) => c.type === "mdxJsxFlowElement" && c.name === "div",
    );
    expect(notesEl).toBeUndefined();
  });
});
