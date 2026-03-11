# astromotion

An unholy mixture of [Astro](https://astro.build),
[Svelte](https://svelte.dev), [Animotion](https://animotion.pages.dev)
(and therefore [Reveal.js](https://revealjs.com)), with a bit of
[Marp](https://marp.app) syntax mixed in --- for markdown-authored slide decks
in Astro sites.

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
  integrations: [
    svelte({ preprocess: [deckPreprocessor()] }),
    astromotion(),
  ],
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

Create `.deck.svelte` files in `src/decks/<slug>/`:

```
src/decks/
  my-talk/
    slides.deck.svelte      -> /decks/my-talk/
    bonus.deck.svelte        -> /decks/my-talk/bonus/
    assets/
      photo.jpg
```

A file named `slides.deck.svelte` maps to the folder root URL. Other names
become sub-paths.

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
- `<!-- notes: Speaker notes here -->` --- presenter notes (visible in
  Reveal.js speaker view)

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

Fenced code blocks are rendered using Animotion's `<Code>` component with
syntax highlighting.

### Animotion components

Sections containing `<Action>`, `<Code>`, `<Transition>`, or other Animotion
components skip markdown processing and pass through as raw Svelte. You can mix
markdown and interactive components freely.

### Script and style blocks

`<script>` and `<style>` blocks are preserved. Animotion component imports are
auto-added if missing.

## Custom theme

The default theme uses an ANU gold/copper/teal colour palette with Public Sans.
To use your own theme, pass the path to the integration:

```js
astromotion({ theme: "./src/my-theme.css" })
```

Your theme CSS replaces the default entirely --- import `@animotion/core/theme`
and define your own styles. See `theme/default.css` in this package for the
full structure.

## Options

```ts
astromotion({
  theme: "./src/my-theme.css",  // custom theme CSS path (default: built-in)
  injectRoutes: true,           // inject /decks/[...slug] route (default: true)
})
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

for (const dir of fs.readdirSync(decksDir, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  for (const file of fs.readdirSync(path.join(decksDir, dir.name))) {
    const match = file.match(/^(.+)\.deck\.svelte$/);
    if (!match) continue;
    const raw = fs.readFileSync(path.join(decksDir, dir.name, file), "utf-8");
    const { data } = parseDeckFrontmatter(raw, dir.name);
    const slug = match[1] === "slides" ? dir.name : `${dir.name}/${match[1]}`;
    decks.push({ slug, title: data.title ?? slug, description: data.description });
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

MIT --- Copyright (c) Ben Swift
