# astromotion

Astro integration + Vite plugin for markdown-authored slide decks powered by
Reveal.js. Consumed as a package by Astro sites --- not a standalone app.

## Commands

- `pnpm test` --- vitest (92 tests across 6 files)

## Architecture

The integration (`index.ts`) registers a Vite plugin, aliases theme CSS via a
virtual module, exposes the `codeTheme` config via a second virtual module, and
injects a catch-all deck route.

### .deck.md (default path, no framework runtime)

The Vite plugin (`src/vite-plugin.ts`) claims `.deck.md` files with
`enforce: "pre"` + `resolveId`/`load` hooks so it runs before Astro's built-in
markdown pipeline. It parses markdown with remark/rehype, splits on `---` into
slides, applies Shiki syntax highlighting and smartypants typography, and
produces HTML `<section>` strings.

The catch-all route (`pages/[...slug].astro`) calls `processDeckMarkdown()` at
build time in `getStaticPaths`, passes the HTML as a prop, and renders it into
a `<div class="reveal"><div class="slides">` wrapper with a `<script>` that
initialises Reveal.js directly.

### .deck.svelte (Svelte opt-in, ships Svelte runtime)

The Svelte preprocessor (`src/preprocessor.ts`) transforms `.deck.svelte` files
into Svelte components with an `onMount` that calls `Reveal.initialize()` and
a `destroy` cleanup. These render via `DeckLoader` with `client:only="svelte"`.

`<script>` and `<style>` blocks are preserved. The preprocessor extracts them,
merges in Reveal.js init code, and re-emits the script block with the user's
content.

### Shared markdown pipeline

Both paths share: remark-parse + remark-gfm + remark-frontmatter for parsing,
rehype-shiki for code highlighting, rehype-stringify for HTML output, plus
custom transforms for includes, bg images, QR codes, logo slides, metadata
directives, and smartypants.

## Key design decisions

- `disableLayout: true` + `display: "grid"` in Reveal.js options so that
  consuming themes can use `place-content: center` on sections
- `theme/base.css` sets `display: grid` on `.reveal .slides section` for the
  same reason
- Speaker notes use `<div class="notes">` not `<aside class="notes">` to avoid
  a11y landmark violations in consuming projects
- Deck pages must not use Astro's `<ClientRouter />` (conflicts with Reveal.js
  keyboard navigation)

## Theming

`theme/base.css` is always imported and provides two things: unlayered
structural CSS (backgrounds, splits, QR codes) and an `@layer astromotion`
block that maps `--r-*` CSS variables to `.reveal` and `.reveal .slides section`
properties (fonts, colours, heading sizes, links, code, Shiki highlighting).

The `@layer` ensures these defaults survive CSS bundling (lightningcss drops
unlayered rules when a consuming theme targets the same selectors) while letting
consuming themes override them without specificity concerns --- unlayered CSS
always beats layered CSS.

Consuming themes only need to set `--r-*` variables in `:root`; the layer
handles mapping them to elements. For ANU-specific overrides (e.g. gold
background on h1), the consuming theme adds unlayered rules which automatically
win.

The consuming project provides visual theme CSS via the integration's `theme`
option; `theme/default.css` re-exports Reveal.js's built-in black theme as a
fallback. `DeckLayout.astro` imports `reveal.js/dist/reveal.css` for core
Reveal.js styles.
