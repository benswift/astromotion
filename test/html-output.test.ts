import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { processDeckMarkdown } from "../src/vite-plugin.ts";

const FIXTURES = resolve(import.meta.dirname, "fixtures");

function fixture(name: string): { content: string; path: string } {
  const path = resolve(FIXTURES, name);
  return { content: readFileSync(path, "utf-8"), path };
}

async function processFixture(name: string): Promise<string> {
  const { content, path } = fixture(name);
  return processDeckMarkdown(content, path);
}

function parseSections(html: string): Element[] {
  // lightweight parsing --- extract top-level <section> elements
  const re = /<section([^>]*)>([\s\S]*?)<\/section>/g;
  const sections: { attrs: string; inner: string }[] = [];
  let match;
  while ((match = re.exec(html)) !== null) {
    sections.push({ attrs: match[1], inner: match[2] });
  }
  return sections as any;
}

describe("processDeckMarkdown HTML output", () => {
  describe("basic.deck.md", () => {
    it("produces the correct number of sections", async () => {
      const html = await processFixture("basic.deck.md");
      const sections = (html.match(/<section/g) || []).length;
      expect(sections).toBe(3);
    });

    it("wraps each slide in a <section> element", async () => {
      const html = await processFixture("basic.deck.md");
      expect(html).toContain("<section>");
      expect(html).toContain("</section>");
    });

    it("does not contain Svelte or animotion artifacts", async () => {
      const html = await processFixture("basic.deck.md");
      expect(html).not.toContain("<Slide");
      expect(html).not.toContain("<Presentation");
      expect(html).not.toContain("<Notes>");
      expect(html).not.toContain("@animotion");
      expect(html).not.toContain("getPresentation");
      expect(html).not.toContain("{@html");
      expect(html).not.toContain("$effect");
    });

    it("renders markdown to HTML inside sections", async () => {
      const html = await processFixture("basic.deck.md");
      expect(html).toContain("<h1>Slide one</h1>");
      expect(html).toContain("<h2>Slide two</h2>");
      expect(html).toContain("<p>Some content here.</p>");
    });
  });

  describe("notes-and-classes.deck.md", () => {
    it("applies _class as a class attribute on the section", async () => {
      const html = await processFixture("notes-and-classes.deck.md");
      expect(html).toContain('class="banner"');
      expect(html).toContain('class="centered"');
    });

    it("renders notes as a div with class notes", async () => {
      const html = await processFixture("notes-and-classes.deck.md");
      expect(html).toContain('<div class="notes">');
      expect(html).toContain("Remember to explain this slowly");
    });

    it("strips metadata comments from output", async () => {
      const html = await processFixture("notes-and-classes.deck.md");
      expect(html).not.toContain("<!-- _class:");
      expect(html).not.toContain("<!-- notes:");
    });
  });

  describe("bg-images.deck.md", () => {
    it("generates slide-bg divs for full-bleed backgrounds", async () => {
      const html = await processFixture("bg-images.deck.md");
      expect(html).toContain('class="slide-bg"');
      expect(html).toContain("https://example.com/photo.jpg");
    });

    it("generates split-layout structure for positioned backgrounds", async () => {
      const html = await processFixture("bg-images.deck.md");
      expect(html).toContain('class="split-layout"');
      expect(html).toContain('class="split-image"');
      expect(html).toContain('class="split-content"');
    });

    it("applies CSS filters from bg modifiers", async () => {
      const html = await processFixture("bg-images.deck.md");
      expect(html).toContain("brightness(0.5)");
      expect(html).toContain("blur(2px)");
    });

    it("sets correct split percentages", async () => {
      const html = await processFixture("bg-images.deck.md");
      expect(html).toContain("width: 40%");
      expect(html).toContain("width: 60%");
    });
  });

  describe("code-blocks.deck.md", () => {
    it("produces shiki-highlighted code blocks", async () => {
      const html = await processFixture("code-blocks.deck.md");
      expect(html).toContain('<pre class="shiki');
      expect(html).toContain("<code>");
    });

    it("does not use Code component", async () => {
      const html = await processFixture("code-blocks.deck.md");
      expect(html).not.toContain("<Code");
    });
  });

  describe("with-includes.deck.md", () => {
    it("inlines included content and splits into correct number of slides", async () => {
      const html = await processFixture("with-includes.deck.md");
      const sections = (html.match(/<section/g) || []).length;
      expect(sections).toBe(5);
      expect(html).toContain("Lesson A: First slide");
      expect(html).toContain("Content from lesson A");
      expect(html).toContain("Lesson B");
    });

    it("does not include the @include directive in output", async () => {
      const html = await processFixture("with-includes.deck.md");
      expect(html).not.toContain("@include");
    });
  });

  describe("output is valid HTML structure", () => {
    it("every section is properly closed", async () => {
      const html = await processFixture("basic.deck.md");
      const opens = (html.match(/<section/g) || []).length;
      const closes = (html.match(/<\/section>/g) || []).length;
      expect(opens).toBe(closes);
    });

    it("does not contain import statements or JS module syntax", async () => {
      const html = await processFixture("basic.deck.md");
      expect(html).not.toContain("import ");
      expect(html).not.toContain("export ");
      expect(html).not.toContain("const ");
    });
  });
});
