# astromotion

An unholy mixture of [Astro](https://astro.build), [Svelte](https://svelte.dev),
[Animotion](https://animotion.pages.dev) (and therefore
[Reveal.js](https://revealjs.com)), with a bit of [Marp](https://marp.app)
syntax mixed in --- for markdown-authored slide decks in Astro sites.

This is shared in the spirit of openness and bonhomie, but it's really quite
idiosyncratic, and I don't expect anyone apart from
[me](https://github.com/benswift/) is going to find it useful.

## Install

```sh
npm install github:benswift/astromotion
```

### Peer dependencies

You also need these in your project:

```sh
npm install astro @astrojs/svelte svelte @animotion/core @tailwindcss/vite
```

## Setup

In your `astro.config.mjs`:

```js
import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import tailwindcss from "@tailwindcss/vite";
import { astromotion, deckPreprocessor } from "astromotion";

export default defineConfig({
  integrations: [svelte({ preprocess: [deckPreprocessor()] }), astromotion()],
  vite: {
    plugins: [tailwindcss()],
  },
});
```

The integration handles:

- injecting the `/decks/[...slug]` route
- aliasing `$app/environment` for Animotion's SvelteKit shim
- resolving the presentation theme CSS

## Writing slides

Create `.deck.svx` files in `src/decks/`:

```
src/decks/
  my-talk.deck.svx            -> /decks/my-talk/
  assets/
    photo.jpg
```

Top-level files use the filename stem as the slug. Subdirectories also work ---
a file named `slides.deck.svx` maps to the folder root URL, and other names
become sub-paths:

```
src/decks/
  my-series/
    slides.deck.svx           -> /decks/my-series/
    bonus.deck.svx            -> /decks/my-series/bonus/
```

### Slide syntax

Slides are markdown separated by `---` (thematic breaks). The preprocessor
converts them into Animotion `<Presentation>` and `<Slide>` components at build
time.

```markdown
---
title: My Talk
description: A talk about things
---

# Title slide

## Subtitle

---

## Second slide

Regular markdown content --- paragraphs, lists, code blocks, images.

---

<!-- _class: impact -->

**Big statement slide**
```

### Metadata directives

Borrowed from Marp syntax:

- `<!-- _class: impact -->` --- set slide CSS class (`impact`, `banner`,
  `quote`, `centered`)
- `<!-- notes: Speaker notes here -->` --- presenter notes (visible in Reveal.js
  speaker view)

### Background images

Also Marp-inspired:

- `![bg](./assets/photo.jpg)` --- full-bleed background
- `![bg contain](url)` / `![bg cover](url)` --- sizing
- `![bg left:50%](url)` / `![bg right:40%](url)` --- split layout
- `![bg blur:5px brightness:0.7](url)` --- CSS filters

Relative paths (`./`, `../`) are resolved as Vite imports. Absolute paths
(`/images/...`) reference `public/`.

### QR codes

```markdown
![qr](https://example.com)
```

Generates an animated SVG QR code linking to the URL.

### Logo slides

```markdown
<!-- _class: anu-logo -->
<!-- _class: socy-logo -->
```

### Code blocks

Fenced code blocks are rendered using Animotion's `<Code>` component with syntax
highlighting.

### Animotion components

Sections containing `<Action>`, `<Code>`, `<Transition>`, or other Animotion
components skip markdown processing and pass through as raw Svelte. You can mix
markdown and interactive components freely.

### Script and style blocks

`<script>` and `<style>` blocks are preserved. Animotion component imports are
auto-added if missing.

## Theming

The default theme (`theme/default.css`) provides only the structural CSS needed
for backgrounds, split layouts, QR codes, and logo slides to render correctly.
All visual styling --- colours, typography, slide classes like `impact` and
`banner` --- is your responsibility.

### Creating a theme

Create a CSS file in your project (e.g. `src/decks/theme.css`) and pass it to
the integration:

```js
astromotion({ theme: "./src/decks/theme.css" });
```

Your theme should start with these imports (the structural defaults layer
underneath):

```css
@import "tailwindcss" source(none);
@source "./";
@import "@animotion/core/theme";
```

Then add your own styles.

### Sharing styles between your site and your decks

If your Astro site and your slide decks share a visual identity (colours, brand
tokens, widget styles), extract the common CSS custom properties into a shared
file (e.g. `src/styles/common.css`) and `@import` it from both your site's
global stylesheet and your deck theme. This keeps values in sync without hacks.

Keep context-specific things separate --- the website and decks have
fundamentally different rendering models (responsive layout vs a fixed
1280×720 viewport scaled to fill the screen), so root font size, layout tokens,
and Reveal.js `--r-*` variables should stay in their respective files.

At a minimum you'll want to set:

- **Reveal.js CSS variables** --- `--r-background-color`, `--r-main-color`,
  `--r-main-font`, `--r-main-font-size`, `--r-heading-color`, `--r-heading-font`,
  `--r-link-color`
- **Slide section base styles** --- padding, text-align, font-weight under
  `.reveal .slides section`
- **Typography** --- heading sizes, paragraph/list sizes, link styles, code blocks
- **Slide classes** --- visual treatments for `banner`, `impact`, `quote`,
  `centered`, and `columns` (these are the classes available via
  `<!-- _class: ... -->` directives)

### Font loading

The theme CSS should only _reference_ fonts (via `font-family`), not _load_
them. Use Astro's built-in font system in your `astro.config.mjs` to handle
font loading:

```js
export default defineConfig({
  fonts: [
    {
      name: "Your Font",
      cssVariable: "--font-your-font",
      provider: fontProviders.google(),
    },
  ],
});
```

### Structural classes reference

These classes are generated by the preprocessor and styled by the default theme.
Your custom theme layers on top of them:

| Class | Purpose |
|---|---|
| `.slide-bg` | Full-bleed background image (absolute positioned) |
| `.split-layout` | Flex wrapper for split image/content slides |
| `.split-image` | Image panel in split layout (width set inline) |
| `.split-content` | Content panel in split layout |
| `.logo-svg` | SVG container for logo slides |
| `.qr-code` | Container for generated QR code SVGs |
| `.columns` | Two-column grid layout within slide content |

## Options

```ts
astromotion({
  theme: "./src/my-theme.css", // custom theme CSS path (default: built-in)
  injectRoutes: true, // inject /decks/[...slug] route (default: true)
});
```

If you set `injectRoutes: false`, you'll need to create your own route pages.
See `pages/[...slug].astro` in this package for the reference implementation.

## Deck listing page

The integration doesn't inject a listing page since it would need your site's
layout. Create your own at `src/pages/decks/index.astro`:

```astro
---
import YourLayout from "../../layouts/YourLayout.astro";
import { parseDeckFrontmatter } from "astromotion";
import fs from "node:fs";
import path from "node:path";

const decksDir = path.resolve("src/decks");
const decks = [];

for (const entry of fs.readdirSync(decksDir, { withFileTypes: true })) {
  if (entry.isDirectory()) {
    for (const file of fs.readdirSync(path.join(decksDir, entry.name))) {
      const match = file.match(/^(.+)\.deck\.svx$/);
      if (!match) continue;
      const raw = fs.readFileSync(path.join(decksDir, entry.name, file), "utf-8");
      const { data } = parseDeckFrontmatter(raw, entry.name);
      const slug = match[1] === "slides" ? entry.name : `${entry.name}/${match[1]}`;
      decks.push({ slug, title: data.title ?? slug, description: data.description });
    }
  } else if (entry.isFile()) {
    const match = entry.name.match(/^(.+)\.deck\.svx$/);
    if (!match) continue;
    const raw = fs.readFileSync(path.join(decksDir, entry.name), "utf-8");
    const { data } = parseDeckFrontmatter(raw, match[1]);
    decks.push({ slug: match[1], title: data.title ?? match[1], description: data.description });
  }
}

decks.sort((a, b) => a.slug.localeCompare(b.slug));
---

<YourLayout title="Decks">
  <h1>Decks</h1>
  <ul>
    {decks.map((deck) => (
      <li>
        <a href={`/decks/${deck.slug}/`}>{deck.title}</a>
        {deck.description && <span> --- {deck.description}</span>}
      </li>
    ))}
  </ul>
</YourLayout>
```

## PDF export

Requires [decktape](https://github.com/astefanutti/decktape):

```sh
npx decktape reveal --size 1280x720 http://localhost:4321/decks/my-talk/ output.pdf
```

Or use the bundled script (builds, starts preview server, exports, and cleans
up):

```sh
node node_modules/astromotion/scripts/deck-pdf.mjs my-talk output.pdf
```

## Licence

MIT --- (c) Ben Swift
