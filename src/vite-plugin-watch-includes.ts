import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseIncludeDirectiveMdx } from "./parse-helpers.ts";

const MAX_DEPTH = 10;
const FLOW_EXPR_RE = /\{\s*(\/\*[\s\S]*?\*\/)\s*\}/g;

function walk(source: string, dir: string, visited: Set<string>, depth: number): void {
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
    walk(content, dirname(absPath), visited, depth + 1);
  }
}

export function collectIncludePaths(source: string, dir: string): string[] {
  const visited = new Set<string>();
  walk(source, dir, visited, 0);
  return Array.from(visited);
}

type ViteServer = {
  watcher: { add: (paths: string | string[]) => void };
  ws: { send: (payload: { type: "full-reload"; path?: string }) => void };
};

export function viteDeckWatchIncludes() {
  const decksByInclude = new Map<string, Set<string>>();
  const includesByDeck = new Map<string, Set<string>>();

  function record(deckId: string, includes: string[]): void {
    const prev = includesByDeck.get(deckId);
    if (prev) {
      for (const p of prev) decksByInclude.get(p)?.delete(deckId);
    }
    const next = new Set(includes);
    includesByDeck.set(deckId, next);
    for (const p of next) {
      let set = decksByInclude.get(p);
      if (!set) {
        set = new Set();
        decksByInclude.set(p, set);
      }
      set.add(deckId);
    }
  }

  let server: ViteServer | null = null;

  return {
    name: "astromotion:watch-includes",
    apply: "serve" as const,
    configureServer(s: ViteServer) {
      server = s;
    },
    transform(_code: string, id: string) {
      const cleanId = id.split("?")[0]!;
      if (!cleanId.endsWith(".deck.mdx")) return null;
      let source: string;
      try {
        source = readFileSync(cleanId, "utf-8");
      } catch {
        return null;
      }
      const paths = collectIncludePaths(source, dirname(cleanId));
      record(cleanId, paths);
      if (server) server.watcher.add(paths);
      return null;
    },
    handleHotUpdate(ctx: { file: string }) {
      const decks = decksByInclude.get(ctx.file);
      if (!decks || decks.size === 0 || !server) return;
      server.ws.send({ type: "full-reload" });
      return [];
    },
  };
}
