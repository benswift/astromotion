# astromotion

Astro integration for markdown-authored slide decks powered by
[Reveal.js](https://revealjs.com), with a bit of
[Marp](https://marp.app) syntax mixed in.

This is shared in the spirit of openness and bonhomie, but it's really quite
idiosyncratic, and I don't expect anyone apart from
[me](https://github.com/benswift/) is going to find it useful.

### About the name

The name is a portmanteau of Astro +
[Animotion](https://animotion.pages.dev). Animotion (a Svelte wrapper around
Reveal.js) was the original runtime, but it was removed in favour of using
Reveal.js directly --- the Svelte runtime and SvelteKit shims weren't worth the
cost when 98% of decks are pure markdown. The name stuck because renaming a
package used across several projects isn't worth the churn.

## Install

```sh
npm install github:benswift/astromotion
```

## Setup

In your `astro.config.mjs`:

```js
import { defineConfig } from "astro/config";
import { astromotion } from "astromotion";

export default defineConfig({
  integrations: [astromotion()],
});
```

The integration registers a Vite plugin that transforms `.deck.md` files into
HTML slides, injects the `/decks/[...slug]` catch-all route, resolves your
theme CSS, and initialises Reveal.js on the client. No framework runtime is
shipped for markdown decks --- slides are server-rendered HTML.

### Svelte for interactive decks

Most decks are pure markdown and should use `.deck.md`. If you have a deck that
needs Svelte interactivity --- custom components, widgets, that sort of thing
--- use `.deck.svelte` instead. You'll need `@astrojs/svelte`, `svelte`, and
`reveal.js` as additional dependencies:

```js
import svelte from "@astrojs/svelte";
import { astromotion, deckPreprocessor } from "astromotion";

export default defineConfig({
  integrations: [
    svelte({ preprocess: [deckPreprocessor()] }),
    astromotion(),
  ],
});
```

The two paths work differently under the hood. `.deck.md` files are processed at
build time by the Vite plugin and rendered as static HTML --- no JavaScript
framework ships to the browser. `.deck.svelte` files go through the Svelte
preprocessor and are loaded client-side via `client:only="svelte"`, which means
the Svelte runtime is included in the bundle.

In `.deck.svelte` files, `<script>` and `<style>` blocks are preserved and
participate in Svelte's component lifecycle. You can import custom components in
the script block. The preprocessor auto-generates the Reveal.js initialisation
code, so you don't need to worry about that.

**Important:** deck pages must not use Astro's `<ClientRouter />` --- it
conflicts with Reveal.js keyboard navigation.

## Writing slides

Create `.deck.md` files in `src/decks/`:

```
src/decks/
  my-talk.deck.md             -> /decks/my-talk/
  assets/
    photo.jpg
```

Top-level files use the filename stem as the slug. Subdirectories also work ---
a file named `slides.deck.md` maps to the folder root URL, and other names
become sub-paths:

```
src/decks/
  my-series/
    slides.deck.md            -> /decks/my-series/
    bonus.deck.md             -> /decks/my-series/bonus/
```

### Frontmatter

Decks support YAML frontmatter with these fields:

```markdown
---
title: My Talk
description: A talk about things
author: Ben Swift
image: /og-image.png
---
```

All fields are optional. `title` falls back to the filename slug. `description`
defaults to "Slide deck". `image` defaults to `/og-image.svg`. These are used
for the page `<title>` and Open Graph / Twitter Card meta tags.

### Slide syntax

Slides are separated by `---` (thematic breaks). The Vite plugin converts each
section into a Reveal.js `<section>` element at build time.

```markdown
---
title: My Talk
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

- `<!-- _class: impact -->` --- set a CSS class on the slide (e.g. `impact`,
  `banner`, `quote`, `centered`, or any custom class your theme defines)
- `<!-- notes: Speaker notes here -->` --- presenter notes, visible in the
  Reveal.js speaker view (press **S**)

### Background images

Also Marp-inspired:

- `![bg](./assets/photo.jpg)` --- full-bleed background
- `![bg contain](url)` / `![bg cover](url)` --- sizing
- `![bg left:50%](url)` / `![bg right:40%](url)` --- split layout (the
  percentage controls the image panel width)
- `![bg blur:5px brightness:0.7 saturate:1.5](url)` --- CSS filters (blur,
  brightness, and saturate can be combined freely)

Absolute paths (`/images/...`) reference `public/`.

### Include directives

You can inline markdown from another file with an include directive:

```markdown
<!-- @include ./shared-intro.md -->
```

Paths are relative to the current deck file. Included content participates in
slide splitting --- thematic breaks inside the included file create new slides.
This is handy for sharing common slides (acknowledgements, logos, boilerplate)
across multiple decks.

### QR codes

```markdown
![qr](https://example.com)
```

Generates an SVG QR code at build time, with CSS animations on the modules
(the little squares morph and shift colour). The animations respect
`prefers-reduced-motion`. The URL is displayed as a clickable link beneath
the code.

### Logo slides

```markdown
<!-- _class: anu-logo -->
<!-- _class: socy-logo -->
```

These generate full-slide animated SVG logos for the Australian National
University and the ANU School of Cybernetics respectively. The gold rule lines
grow in and the logo fades in, with the animations also respecting
`prefers-reduced-motion`.

### Code blocks

Fenced code blocks get syntax highlighting at build time via
[Shiki](https://shiki.style). The theme defaults to `vitesse-dark` but is
configurable --- see Options below.

### Smart typography

[Smartypants](https://www.npmjs.com/package/smartypants) runs on all slide
content, converting straight quotes to curly quotes, triple dashes to em
dashes, double dashes to en dashes, and triple dots to ellipsis characters.

## Theming

The default theme re-exports Reveal.js's built-in black theme. For custom
styling, create a CSS file and pass it to the integration:

```js
astromotion({ theme: "./src/decks/theme.css" });
```

Your theme CSS sets Reveal.js CSS variables and slide class styles. At a
minimum you'll want:

- **Reveal.js CSS variables** --- `--r-background-color`, `--r-main-color`,
  `--r-main-font`, `--r-main-font-size`, `--r-heading-color`,
  `--r-heading-font`, `--r-link-color`
- **Slide section base styles** --- padding, text-align, font-weight under
  `.reveal .slides section`
- **Slide classes** --- visual treatments for `banner`, `impact`, `quote`,
  `centered` (the classes available via `<!-- _class: ... -->` directives)

### Structural classes reference

These classes are generated by the build pipeline and styled by the base theme.
Your custom theme layers on top:

| Class | Purpose |
|---|---|
| `.slide-bg` | Full-bleed background image (absolute positioned) |
| `.split-layout` | Flex wrapper for split image/content slides |
| `.split-image` | Image panel in split layout (width set inline) |
| `.split-content` | Content panel in split layout |
| `.logo-svg` | SVG container for logo slides |
| `.qr-code` | Container for generated QR code SVGs |

### Sharing styles between your site and your decks

If your Astro site and your slide decks share a visual identity, extract the
common CSS custom properties into a shared file (e.g. `src/styles/common.css`)
and `@import` it from both your site's global stylesheet and your deck theme.

Keep context-specific things separate --- the website and decks have
fundamentally different rendering models (responsive layout vs a fixed 1280x720
viewport scaled to fill the screen), so root font size, layout tokens, and
Reveal.js `--r-*` variables should stay in their respective files.

### Font loading

The theme CSS should only _reference_ fonts (via `font-family`), not _load_
them. Use Astro's built-in font system in your `astro.config.mjs`:

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

## Options

```ts
astromotion({
  theme: "./src/my-theme.css",   // custom theme CSS path (default: built-in black theme)
  injectRoutes: true,            // inject /decks/[...slug] route (default: true)
  codeTheme: "vitesse-dark",     // Shiki theme name or object (default: "vitesse-dark")
  preprocess: (md, filePath) => md,  // transform markdown before slide processing (optional)
});
```

The `codeTheme` option accepts a Shiki theme name (string) or an object passed
directly to `@shikijs/rehype` --- for example, dual light/dark themes:

```js
astromotion({
  codeTheme: {
    themes: { light: anuLight, dark: anuDark },
    defaultColor: false,
  },
});
```

The `preprocess` option accepts a function `(markdown: string, filePath: string) => string | Promise<string>` that transforms the raw deck markdown before any slide processing. The function receives the file content and its absolute path, and should return the transformed markdown. This runs before frontmatter parsing, include resolution, and slide splitting --- so your preprocessor sees the original source and can make arbitrary changes.

Use cases include resolving custom directives, injecting content from external sources, or expanding shorthand syntax. The preprocessor is intentionally generic --- astromotion doesn't prescribe what transformations you apply.

If you set `injectRoutes: false`, you'll need to create your own route pages.
See `pages/[...slug].astro` in this package for the reference implementation.

## Reveal.js configuration

The integration configures Reveal.js with these options:

- **1280x720** slide dimensions, no margin
- **linear navigation** (no 2D grid) with no on-screen controls
- **hash-based URLs** with 1-based indexing (`#/1`, `#/2`, etc.)
- **no transitions** between slides
- **CSS grid display** with centering (so `place-content: center` works in your
  theme CSS)
- **`viewDistance: 10`** for preloading nearby slides

These aren't currently configurable by the consumer --- they're hardcoded in the
catch-all route. If you need different settings, set `injectRoutes: false` and
write your own route.

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
      const match = file.match(/^(.+)\.deck\.md$/);
      if (!match) continue;
      const raw = fs.readFileSync(path.join(decksDir, entry.name, file), "utf-8");
      const { data } = parseDeckFrontmatter(raw, entry.name);
      const slug = match[1] === "slides" ? entry.name : `${entry.name}/${match[1]}`;
      decks.push({ slug, title: data.title ?? slug, description: data.description });
    }
  } else if (entry.isFile()) {
    const match = entry.name.match(/^(.+)\.deck\.md$/);
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

Or use the bundled script, which builds, starts a preview server, exports, and
cleans up:

```sh
node node_modules/astromotion/scripts/deck-pdf.mjs my-talk output.pdf
```

The script waits up to 30 seconds for the preview server to respond and uses
generous pauses between slides (5 seconds load, 4 seconds per slide) to handle
heavy decks.

## Exports

The package exports:

- **`astromotion(options?)`** --- the Astro integration (this is what you use)
- **`deckPreprocessor(options?)`** --- Svelte preprocessor for `.deck.svelte`
  files
- **`parseDeckFrontmatter(raw, slug?)`** --- parse YAML frontmatter from a deck
  file (useful for listing pages)
- **`deckPlugin(options?)`** --- the Vite plugin, exported for internal use by
  the integration; you shouldn't need this directly

## Licence

MIT --- (c) Ben Swift
