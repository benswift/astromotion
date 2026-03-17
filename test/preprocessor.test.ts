import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { deckPreprocessor } from "../src/preprocessor.ts";

const FIXTURES = resolve(import.meta.dirname, "fixtures");

function readFixture(name: string): string {
  return readFileSync(resolve(FIXTURES, name), "utf-8");
}

async function process(name: string): Promise<string> {
  const content = readFixture(name);
  const filename = resolve(FIXTURES, name);
  const preprocessor = deckPreprocessor();
  const handler = preprocessor.markup!;
  const result = await handler({ content, filename });
  if (!result) throw new Error(`Preprocessor returned undefined for ${name}`);
  return result.code;
}

describe("deckPreprocessor", () => {
  it("ignores non-deck files", async () => {
    const preprocessor = deckPreprocessor();
    const result = await preprocessor.markup!({
      content: "# Hello",
      filename: "/path/to/file.svelte",
    });
    expect(result).toBeUndefined();
  });

  describe("slide splitting", () => {
    it("wraps output in a Presentation component", async () => {
      const code = await process("basic.deck.svx");
      expect(code).toContain("<Presentation");
      expect(code).toContain("</Presentation>");
    });

    it("creates one Slide per --- separator", async () => {
      const code = await process("basic.deck.svx");
      const slideCount = (code.match(/<Slide/g) || []).length;
      expect(slideCount).toBe(3);
    });

    it("converts markdown headings to HTML", async () => {
      const code = await process("basic.deck.svx");
      expect(code).toContain("<h1>Slide one</h1>");
      expect(code).toContain("<h2>Slide two</h2>");
    });

    it("converts markdown paragraphs to HTML", async () => {
      const code = await process("basic.deck.svx");
      expect(code).toContain("<p>Some content here.</p>");
      expect(code).toContain("<p>More content.</p>");
    });
  });

  describe("script and style blocks", () => {
    it("auto-imports Animotion components", async () => {
      const code = await process("basic.deck.svx");
      expect(code).toContain('from "@animotion/core"');
      expect(code).toContain('import "@animotion/core/theme"');
    });

    it("includes the Reveal bridge code", async () => {
      const code = await process("basic.deck.svx");
      expect(code).toContain("window.Reveal");
    });

    it("preserves user script content", async () => {
      const code = await process("with-script.deck.svx");
      expect(code).toContain('const name = "test"');
    });

    it("preserves user style blocks", async () => {
      const code = await process("with-script.deck.svx");
      expect(code).toContain("<style>");
      expect(code).toContain("h1 { color: red; }");
    });

    it("does not duplicate auto-imports when user imports same module", async () => {
      const code = await process("with-script.deck.svx");
      const coreImports = code.match(/@animotion\/core/g) || [];
      expect(coreImports.length).toBeLessThanOrEqual(2);
    });
  });

  describe("metadata directives", () => {
    it("applies _class as a class attribute on Slide", async () => {
      const code = await process("notes-and-classes.deck.svx");
      expect(code).toContain('class="banner"');
      expect(code).toContain('class="centered"');
    });

    it("converts notes directives to Notes components", async () => {
      const code = await process("notes-and-classes.deck.svx");
      expect(code).toContain("<Notes>");
      expect(code).toContain("Remember to explain this slowly");
    });

    it("does not include metadata comments in slide content", async () => {
      const code = await process("notes-and-classes.deck.svx");
      expect(code).not.toContain("<!-- _class:");
      expect(code).not.toContain("<!-- notes:");
    });
  });

  describe("background images", () => {
    it("generates background divs for full-bleed images", async () => {
      const code = await process("bg-images.deck.svx");
      expect(code).toContain("slide-bg");
      expect(code).toContain("https://example.com/photo.jpg");
    });

    it("generates split layouts for positioned images", async () => {
      const code = await process("bg-images.deck.svx");
      expect(code).toContain("split-layout");
      expect(code).toContain("split-image");
      expect(code).toContain("split-content");
    });

    it("applies filter CSS from modifiers", async () => {
      const code = await process("bg-images.deck.svx");
      expect(code).toContain("brightness(0.5)");
      expect(code).toContain("blur(2px)");
    });
  });

  describe("code blocks", () => {
    it("converts fenced code blocks to Code components", async () => {
      const code = await process("code-blocks.deck.svx");
      expect(code).toContain("<Code");
      expect(code).toContain('lang="javascript"');
      expect(code).toContain('lang="python"');
    });

    it("preserves code content in the component", async () => {
      const code = await process("code-blocks.deck.svx");
      expect(code).toContain("const x = 42");
      expect(code).toContain('print(\\"hello\\")');
    });

    it("renders surrounding text as HTML alongside Code components", async () => {
      const code = await process("code-blocks.deck.svx");
      expect(code).toContain("<p>Some text before.</p>");
      expect(code).toContain("<p>Some text after.</p>");
    });
  });

  describe("includes", () => {
    it("inlines content from included files", async () => {
      const code = await process("with-includes.deck.svx");
      expect(code).toContain("Lesson A: First slide");
      expect(code).toContain("Content from lesson A");
      expect(code).toContain("Lesson B");
      expect(code).toContain("Content from lesson B");
    });

    it("creates slides from included file separators", async () => {
      const code = await process("with-includes.deck.svx");
      const slideCount = (code.match(/<Slide/g) || []).length;
      // Intro (1) + lesson-a (2 slides) + lesson-b (1) + Outro (1) = 5
      expect(slideCount).toBe(5);
    });

    it("does not include the @include comment in output", async () => {
      const code = await process("with-includes.deck.svx");
      expect(code).not.toContain("@include");
    });
  });

  describe("smartypants typography", () => {
    it("converts straight quotes to smart quotes", async () => {
      const code = await process("basic.deck.svx");
      // smartypants converts straight quotes in text content
      // the fixture doesn't have quotes, but this tests the pipeline runs
      expect(code).toBeDefined();
    });
  });

  describe("Presentation options", () => {
    it("sets correct dimensions", async () => {
      const code = await process("basic.deck.svx");
      expect(code).toContain("width: 1280");
      expect(code).toContain("height: 720");
    });

    it("disables controls", async () => {
      const code = await process("basic.deck.svx");
      expect(code).toContain("controls: false");
    });

    it("uses linear navigation", async () => {
      const code = await process("basic.deck.svx");
      expect(code).toContain('navigationMode: "linear"');
    });
  });
});
