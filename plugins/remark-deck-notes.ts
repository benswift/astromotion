import type { Root, RootContent } from "mdast";
import { parseNotesDirectiveMdx } from "../src/parse-helpers.ts";

export function remarkDeckNotes() {
  return (tree: Root, file: { path?: string }) => {
    if (!file.path?.endsWith(".deck.mdx")) return;
    for (const section of tree.children) {
      if ((section as any).type !== "mdxJsxFlowElement" || (section as any).name !== "section")
        continue;
      const sec = section as any;
      const newChildren: RootContent[] = [];
      let notesContent: string | null = null;
      for (const child of sec.children as RootContent[]) {
        if ((child as any).type === "mdxFlowExpression") {
          const notes = parseNotesDirectiveMdx((child as any).value);
          if (notes !== null) {
            notesContent = notes;
            continue;
          }
        }
        newChildren.push(child);
      }
      if (notesContent !== null) {
        newChildren.push({
          type: "mdxJsxFlowElement",
          name: "div",
          attributes: [{ type: "mdxJsxAttribute", name: "class", value: "notes" }],
          children: [{ type: "html", value: notesContent } as any],
        } as any);
      }
      sec.children = newChildren;
    }
  };
}
