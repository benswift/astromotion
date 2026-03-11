import type { AstroIntegration } from "astro";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface AstromotionOptions {
  theme?: string;
  injectRoutes?: boolean;
}

export function astromotion(options: AstromotionOptions = {}): AstroIntegration {
  const { injectRoutes = true } = options;
  const shimPath = resolve(__dirname, "sveltekit-shims/environment.js");
  const themePath = options.theme
    ? resolve(options.theme)
    : resolve(__dirname, "theme/default.css");

  return {
    name: "astromotion",
    hooks: {
      "astro:config:setup"({ updateConfig, injectRoute }) {
        updateConfig({
          vite: {
            resolve: {
              alias: {
                "$app/environment": shimPath,
                "virtual:astromotion/theme": themePath,
              },
            },
            optimizeDeps: {
              esbuildOptions: {
                plugins: [
                  {
                    name: "astromotion-shims",
                    setup(build) {
                      build.onResolve(
                        { filter: /^\$app\/environment$/ },
                        () => ({ path: shimPath }),
                      );
                    },
                  },
                ],
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
    },
  };
}

export { deckPreprocessor } from "./src/preprocessor.ts";
export { parseDeckFrontmatter } from "./src/meta.ts";
