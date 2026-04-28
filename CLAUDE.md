# astromotion

Astro integration + Vite plugin for markdown-authored slide decks powered by
Reveal.js. Consumed as a package by Astro sites --- not a standalone app.

## Commands

- `pnpm test` --- vitest

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

Both paths share a unified remark/rehype pipeline plus custom transforms for
includes, bg images, QR codes, logo slides, metadata directives, and
smartypants.

## Image paths

Deck images must use relative paths (e.g. `./assets/photo.jpg`). Relative paths
are resolved via Vite imports in the plugin path and via `resolveImageUrl` (which
prepends `config.base`) in the static HTML path. Absolute paths (`/images/...`)
are passed through unmodified and will 404 on subpath deployments --- this is
intentional to fail early rather than mask content bugs.

## Key design decisions

- Slides render onto a fixed 1280×720 canvas, scaled to fit the viewport via
  Reveal.js's built-in `transform: scale()` layout. `maxScale: 4` lifts
  Reveal's default 2.0 cap so 4K monitors fill rather than letterbox. Slides
  look pixel-identical at any viewport because the rem/px units are anchored
  to the canvas, not the viewport.
- `display: "grid"` in Reveal.js options + matching `display: grid` in
  `theme/base.css` so consuming themes can use `place-content: center` on
  sections (Reveal sets `display` inline on the active section, so the config
  option is what propagates `grid` rather than the default `block`).
- Speaker notes use `<div class="notes">` not `<aside class="notes">` to avoid
  a11y landmark violations in consuming projects
- Deck pages must not use Astro's `<ClientRouter />` (conflicts with Reveal.js
  keyboard navigation)

## Theming

`theme/base.css` is always imported and provides two things: unlayered
structural CSS (backgrounds, splits, QR codes) and an `@layer astromotion`
block that maps `--r-*` CSS variables to `.reveal` and `.reveal .slides section`
properties (fonts, colours, heading sizes, links, code, Shiki highlighting).

Consuming themes only need to set `--r-*` variables in `:root`; the layer
handles mapping them to elements. For ANU-specific overrides (e.g. gold
background on h1), the consuming theme adds unlayered rules which automatically
win.

The consuming project provides visual theme CSS via the integration's `theme`
option.
