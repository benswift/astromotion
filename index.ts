import type { AstroIntegration } from "astro";
import mdx from "@astrojs/mdx";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectDeckAssets } from "./src/asset-collector.ts";
import { deckRemarkPlugins } from "./plugins/index.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface AstromotionOptions {
  theme?: string;
  injectRoutes?: boolean;
  codeTheme?: string | Record<string, unknown>;
}

export function astromotion(options: AstromotionOptions = {}): AstroIntegration {
  const { injectRoutes = true } = options;
  const themePath = options.theme
    ? resolve(options.theme)
    : resolve(__dirname, "theme/default.css");

  let projectRoot = "";

  return {
    name: "astromotion",
    hooks: {
      "astro:config:setup"({ updateConfig, injectRoute, config }) {
        projectRoot = fileURLToPath(config.root);
        const codeThemeValue = options.codeTheme ?? "vitesse-dark";

        const hasMdx = config.integrations.some((i) => i.name === "@astrojs/mdx");
        if (!hasMdx) {
          updateConfig({
            integrations: [
              mdx({
                remarkPlugins: deckRemarkPlugins,
                shikiConfig: {
                  theme:
                    typeof codeThemeValue === "string" ? codeThemeValue : "vitesse-dark",
                },
              }),
            ],
          });
        }

        updateConfig({
          vite: {
            resolve: {
              alias: {
                "virtual:astromotion/theme": themePath,
              },
            },
          },
        });

        if (injectRoutes) {
          injectRoute({
            pattern: "/decks/[...slug]",
            entrypoint: "astromotion/pages/[...slug].astro",
          });
        }
      },
      "astro:build:done"({ dir, logger }) {
        const decksDir = resolve(projectRoot, "src/decks");
        try {
          const assets = collectDeckAssets(decksDir);
          for (const asset of assets) {
            const relPath = relative(projectRoot, asset);
            const dest = resolve(fileURLToPath(dir), relPath);
            mkdirSync(dirname(dest), { recursive: true });
            copyFileSync(asset, dest);
          }
          if (assets.length > 0) {
            logger.info(`Copied ${assets.length} deck asset(s) to build output.`);
          }
        } catch {
          // No src/decks directory — nothing to copy
        }
      },
    },
  };
}

export { deckRemarkPlugins } from "./plugins/index.ts";
export { parseDeckFrontmatter } from "./src/meta.ts";
