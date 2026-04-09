# Changelog

## 2026-04-09

### Image resolution rewritten --- relative paths only

The image handling pipeline has been rewritten to use the remark AST instead of
regex-based HTML string parsing.

**Breaking: absolute image paths are no longer resolved.** Paths like
`/assets/photo.jpg` in deck markdown are passed through as-is and will 404 on
subpath deployments. Use relative paths (`./assets/photo.jpg`) instead --- these
are resolved correctly for both the Vite plugin path (via ES module imports) and
the static HTML path (via `resolveImageUrl`).

**`processDeckMarkdown` accepts a `base` option.** The catch-all `[...slug].astro`
page passes `import.meta.env.BASE_URL` so that resolved relative paths include
the deployment base path in the generated HTML. This only affects the static
HTML path --- the Vite plugin path uses imports which Vite resolves natively.

**Migration:** change any `/assets/...` or `/images/...` paths in deck files to
`./assets/...`. Background images (`![bg](...)`) and inline images (`![](...)`)
both need relative paths. The build will fail visibly if an image path can't be
resolved, which is the intended behaviour.

### Internal changes

- `resolveAstImageUrls`: walks mdast to resolve relative image URLs in-place
  (replaces `resolveInlineImgSrcs`)
- `collectAstImageImports`: walks mdast to collect relative URLs into the import
  map with placeholder tokens (replaces `replaceRelativeImgSrcs`)
- `htmlToSegments`: splits stringified HTML on placeholders into segments
  (replaces regex-based `findRelativeImgSrcs` usage in vite-plugin.ts)
- `findRelativeImgSrcs` removed from vite-plugin.ts imports (still used by the
  Svelte preprocessor)

## 2026-04-08

- `.svx` extension support for deck files
- add oxlint, oxfmt, and stylelint configs
- replace regex parsing with structured helpers in parse-helpers.ts

## 2026-04-07

- `@layer astromotion` wraps `--r-*` variable mappings in base.css
- remove built-in logo slide generation --- consumers provide their own logo
  content and CSS
- keep `<style>` blocks inline for `.deck.md` files (previously extracted)
- resolve `@include` directives at text level before parsing

## 2026-04-06

- `preprocess` option: transform raw deck markdown before slide processing
- `preprocessModule` support for passing preprocessors via virtual module

## 2026-04-03

- remove Animotion dependency, use Reveal.js directly (no Svelte runtime for
  `.deck.md` files)
- configurable Shiki code theme (default: `vitesse-dark`)

## 2026-04-01

- remove Tailwind CSS dependency
- configurable code block theme

## 2026-03-18

- vitest test suite
- `@include` directive for composing decks from separate files

## 2026-03-17

- rename `.deck.svelte` to `.deck.svx`
- support top-level deck files (not just subdirectories)

## 2026-03-11

- structural base.css split from visual theme
- edge-to-edge slides (`margin: 0`), linear navigation, hash-based URLs
- `disableLayout: true` + `display: grid` for CSS-based centering

## 2026-03-11

Initial package.
