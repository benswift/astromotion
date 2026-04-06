import type { AstroIntegration } from "astro";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { deckPlugin } from "./src/vite-plugin.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface AstromotionOptions {
  theme?: string;
  injectRoutes?: boolean;
  codeTheme?: string | Record<string, unknown>;
  preprocess?: (markdown: string, filePath: string) => string | Promise<string>;
}

export function astromotion(options: AstromotionOptions = {}): AstroIntegration {
  const { injectRoutes = true } = options;
  const themePath = options.theme
    ? resolve(options.theme)
    : resolve(__dirname, "theme/default.css");

  return {
    name: "astromotion",
    hooks: {
      "astro:config:setup"({ updateConfig, injectRoute }) {
        const codeThemeValue = options.codeTheme ?? "vitesse-dark";
        const codeThemeModule = `export default ${JSON.stringify(codeThemeValue)};`;

        updateConfig({
          vite: {
            resolve: {
              alias: {
                "virtual:astromotion/theme": themePath,
              },
            },
            plugins: [
              deckPlugin({ codeTheme: options.codeTheme, preprocess: options.preprocess }),
              {
                name: "astromotion-config",
                resolveId(id) {
                  if (id === "virtual:astromotion/code-theme") return "\0astromotion-code-theme";
                },
                load(id) {
                  if (id === "\0astromotion-code-theme") return codeThemeModule;
                },
              },
            ],
          },
        });

        if (injectRoutes) {
          injectRoute({
            pattern: "/decks/[...slug]",
            entrypoint: "astromotion/pages/[...slug].astro",
          });
        }
      },
    },
  };
}

export { deckPreprocessor } from "./src/preprocessor.ts";
export { deckPlugin } from "./src/vite-plugin.ts";
export { parseDeckFrontmatter } from "./src/meta.ts";
