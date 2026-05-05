import type { Root, RootContent, Html } from "mdast";
import { parseClassDirective } from "../src/parse-helpers.ts";

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
        if (child.type === "html") {
          const cls = parseClassDirective((child as Html).value);
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
