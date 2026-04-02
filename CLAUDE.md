# astromotion

Astro integration + Vite plugin for markdown-authored slide decks powered by
Reveal.js. Consumed as a package by Astro sites --- not a standalone app.

## Commands

- `pnpm test` --- vitest

## Architecture

The integration (`index.ts`) registers a Vite plugin, aliases theme CSS, and
injects a catch-all deck route.

The Vite plugin (`src/vite-plugin.ts`) transforms `.deck.md` files: parses
markdown with remark/rehype, splits on `---` into slides, applies syntax
highlighting via shiki, and emits JS modules exporting HTML `<section>` strings.
The catch-all route renders these into a `<div class="reveal"><div
class="slides">` wrapper with a `<script>` that initialises Reveal.js directly
--- no framework runtime needed.

For interactive decks that need Svelte, use the `.deck.svelte` extension. The
Svelte preprocessor (`src/preprocessor.ts`) transforms these into Svelte
components with an `onMount` that calls `Reveal.initialize()`. These render via
`DeckLoader` with `client:only="svelte"`.

Deck pages must not use Astro's `<ClientRouter />` (conflicts with Reveal.js
keyboard navigation).

## Theming

`theme/base.css` is structural (backgrounds, splits, logos) and always imported.
The consuming project provides visual theme CSS via the integration's `theme`
option; `theme/default.css` re-exports reveal.js's built-in black theme as a
fallback.
