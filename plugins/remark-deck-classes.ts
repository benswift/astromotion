import type { Root, RootContent } from "mdast";
import { parseClassDirectiveMdx } from "../src/parse-helpers.ts";

export function remarkDeckClasses() {
  return (tree: Root, file: { path?: string }) => {
    if (!file.path?.endsWith(".deck.mdx")) return;
    for (const section of tree.children) {
      if ((section as any).type !== "mdxJsxFlowElement" || (section as any).name !== "section")
        continue;
      const sec = section as any;
      const newChildren: RootContent[] = [];
      let className: string | null = null;
      for (const child of sec.children as RootContent[]) {
        if ((child as any).type === "mdxFlowExpression") {
          const cls = parseClassDirectiveMdx((child as any).value);
          if (cls !== null) {
            className = cls;
            continue;
          }
        }
        newChildren.push(child);
      }
      sec.children = newChildren;
      if (className !== null) {
        sec.attributes.push({ type: "mdxJsxAttribute", name: "class", value: className });
      }
    }
  };
}
