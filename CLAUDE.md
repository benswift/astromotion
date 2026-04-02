# astromotion

Astro integration + Svelte preprocessor for markdown-authored slide decks.
Consumed as a package by Astro sites --- not a standalone app.

## Commands

- `pnpm test` --- vitest

## Architecture

The integration (`index.ts`) aliases theme CSS via Vite and injects a catch-all
deck route. The preprocessor (`src/preprocessor.ts`) transforms `.deck.svx`
files: parses markdown with remark/rehype, splits on `---` into slides, and
emits `<Presentation><Slide>` Svelte output. Sections containing animotion
components (`<Action>`, `<Code>`, etc.) skip markdown processing and pass
through as raw Svelte.

`sveltekit-shims/environment.js` exists because animotion imports
`$app/environment` (a SvelteKit module) --- the integration aliases it to this
shim since we run under Astro, not SvelteKit.

Deck pages use `client:only="svelte"` and must not use Astro's `<ClientRouter
/>` (conflicts with Reveal.js keyboard navigation).

## Theming

`theme/base.css` is structural (backgrounds, splits, logos) and always imported.
The consuming project provides visual theme CSS via the integration's `theme`
option; `theme/default.css` re-exports animotion's built-in theme as a fallback.
