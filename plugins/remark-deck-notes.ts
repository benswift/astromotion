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
        // `<aside class="notes">` is the element Reveal's notes plugin reads
        // for the speaker view; reveal core CSS hides it (`display:none`) so
        // the audience never sees it. `aria-hidden` is needed too: the notes
        // are presenter-only, and a static a11y scan (which doesn't apply
        // reveal's CSS, so it treats the aside as visible) would otherwise flag
        // it as a complementary landmark nested inside <main>.
        newChildren.push({
          type: "mdxJsxFlowElement",
          name: "aside",
          attributes: [
            { type: "mdxJsxAttribute", name: "class", value: "notes" },
            { type: "mdxJsxAttribute", name: "aria-hidden", value: "true" },
          ],
          children: [{ type: "html", value: notesContent } as any],
        } as any);
      }
      sec.children = newChildren;
    }
  };
}
