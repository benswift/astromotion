import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseIncludeDirectiveMdx } from "./parse-helpers.ts";

const MAX_DEPTH = 10;
const FLOW_EXPR_RE = /\{\s*(\/\*[\s\S]*?\*\/)\s*\}/g;

function collectIncludes(source: string, dir: string, visited: Set<string>, depth: number): void {
  if (depth > MAX_DEPTH) return;
  for (const match of source.matchAll(FLOW_EXPR_RE)) {
    const includePath = parseIncludeDirectiveMdx(match[1]!);
    if (!includePath) continue;
    if (!includePath.endsWith(".mdx")) continue;
    const absPath = resolve(dir, includePath);
    if (visited.has(absPath)) continue;
    visited.add(absPath);
    let content: string;
    try {
      content = readFileSync(absPath, "utf-8");
    } catch {
      continue;
    }
    collectIncludes(content, dirname(absPath), visited, depth + 1);
  }
}

export function viteDeckWatchIncludes() {
  return {
    name: "astromotion:watch-includes",
    enforce: "pre" as const,
    transform(this: { addWatchFile: (path: string) => void }, code: string, id: string) {
      const cleanId = id.split("?")[0]!;
      if (!cleanId.endsWith(".deck.mdx")) return null;
      const visited = new Set<string>();
      collectIncludes(code, dirname(cleanId), visited, 0);
      for (const absPath of visited) {
        this.addWatchFile(absPath);
      }
      return null;
    },
  };
}
