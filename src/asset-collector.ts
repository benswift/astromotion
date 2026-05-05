import { readdirSync } from "node:fs";
import { resolve } from "node:path";

export function collectDeckAssets(decksDir: string): string[] {
  const assets: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (!/\.deck\.(mdx|md|svx|svelte)$/.test(entry.name) && !entry.name.endsWith(".css")) {
        assets.push(full);
      }
    }
  }
  walk(decksDir);
  return assets;
}
