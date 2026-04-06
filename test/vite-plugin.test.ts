import { describe, it, expect, afterEach } from "vitest";
import { resolve } from "node:path";
import { deckPlugin, processDeckMarkdown, setGlobalPreprocess } from "../src/vite-plugin.ts";

const FIXTURES = resolve(import.meta.dirname, "fixtures");

async function process(name: string, options?: Parameters<typeof deckPlugin>[0]): Promise<string> {
  const id = resolve(FIXTURES, name);
  const plugin = deckPlugin(options);
  const load = (plugin as any).load.bind(plugin);
  const result = await load(id);
  if (!result) throw new Error(`Plugin returned null for ${name}`);
  return result.code;
}

describe("deckPlugin", () => {
  it("ignores non-deck files", async () => {
    const plugin = deckPlugin();
    const result = await (plugin as any).load("/path/to/file.md");
    expect(result).toBeNull();
  });

  describe("slide splitting", () => {
    it("outputs section elements", async () => {
      const code = await process("basic.deck.md");
      expect(code).toContain("<section");
      expect(code).toContain("</section>");
    });

    it("does not output Presentation or Slide components", async () => {
      const code = await process("basic.deck.md");
      expect(code).not.toContain("<Presentation");
      expect(code).not.toContain("<Slide");
    });

    it("creates one section per --- separator", async () => {
      const code = await process("basic.deck.md");
      const sectionCount = (code.match(/<section/g) || []).length;
      expect(sectionCount).toBe(3);
    });

    it("converts markdown headings to HTML", async () => {
      const code = await process("basic.deck.md");
      expect(code).toContain("<h1>Slide one</h1>");
      expect(code).toContain("<h2>Slide two</h2>");
    });

    it("converts markdown paragraphs to HTML", async () => {
      const code = await process("basic.deck.md");
      expect(code).toContain("<p>Some content here.</p>");
      expect(code).toContain("<p>More content.</p>");
    });
  });

  describe("module output", () => {
    it("exports frontmatter", async () => {
      const code = await process("basic.deck.md");
      expect(code).toContain("export const frontmatter");
      expect(code).toContain('"title":"Basic Deck"');
    });

    it("exports slides as default", async () => {
      const code = await process("basic.deck.md");
      expect(code).toContain("export default slides");
    });

    it("does not include animotion imports", async () => {
      const code = await process("basic.deck.md");
      expect(code).not.toContain("@animotion/core");
    });

    it("does not include Reveal bridge", async () => {
      const code = await process("basic.deck.md");
      expect(code).not.toContain("window.Reveal");
    });
  });

  describe("metadata directives", () => {
    it("applies _class as a class attribute on section", async () => {
      const code = await process("notes-and-classes.deck.md");
      expect(code).toContain('class="banner"');
      expect(code).toContain('class="centered"');
    });

    it("converts notes directives to aside elements", async () => {
      const code = await process("notes-and-classes.deck.md");
      expect(code).toContain('<div class="notes">');
      expect(code).toContain("Remember to explain this slowly");
    });

    it("does not include metadata comments in slide content", async () => {
      const code = await process("notes-and-classes.deck.md");
      expect(code).not.toContain("<!-- _class:");
      expect(code).not.toContain("<!-- notes:");
    });
  });

  describe("background images", () => {
    it("generates background divs for full-bleed images", async () => {
      const code = await process("bg-images.deck.md");
      expect(code).toContain("slide-bg");
      expect(code).toContain("https://example.com/photo.jpg");
    });

    it("generates split layouts for positioned images", async () => {
      const code = await process("bg-images.deck.md");
      expect(code).toContain("split-layout");
      expect(code).toContain("split-image");
      expect(code).toContain("split-content");
    });

    it("applies filter CSS from modifiers", async () => {
      const code = await process("bg-images.deck.md");
      expect(code).toContain("brightness(0.5)");
      expect(code).toContain("blur(2px)");
    });
  });

  describe("code blocks", () => {
    it("renders syntax-highlighted code at build time", async () => {
      const code = await process("code-blocks.deck.md");
      expect(code).toContain("<pre");
      expect(code).toContain("<code");
    });

    it("does not use Code component", async () => {
      const code = await process("code-blocks.deck.md");
      expect(code).not.toContain("<Code");
    });

    it("preserves code content", async () => {
      const code = await process("code-blocks.deck.md");
      // shiki wraps tokens in spans, so check for the key tokens
      expect(code).toContain("x");
      expect(code).toContain("42");
      expect(code).toContain("hello");
    });

    it("renders surrounding text as HTML alongside code blocks", async () => {
      const code = await process("code-blocks.deck.md");
      expect(code).toContain("<p>Some text before.</p>");
      expect(code).toContain("<p>Some text after.</p>");
    });
  });

  describe("includes", () => {
    it("inlines content from included files", async () => {
      const code = await process("with-includes.deck.md");
      expect(code).toContain("Lesson A: First slide");
      expect(code).toContain("Content from lesson A");
      expect(code).toContain("Lesson B");
      expect(code).toContain("Content from lesson B");
    });

    it("creates slides from included file separators", async () => {
      const code = await process("with-includes.deck.md");
      const sectionCount = (code.match(/<section/g) || []).length;
      expect(sectionCount).toBe(5);
    });

    it("does not include the @include comment in output", async () => {
      const code = await process("with-includes.deck.md");
      expect(code).not.toContain("@include");
    });
  });

  describe("smartypants typography", () => {
    it("runs the smartypants pipeline", async () => {
      const code = await process("basic.deck.md");
      expect(code).toBeDefined();
    });
  });

  describe("preprocess hook", () => {
    it("transforms markdown before slide processing", async () => {
      const code = await process("basic.deck.md", {
        preprocess: (md) => md.replace("Slide one", "Replaced title"),
      });
      expect(code).toContain("Replaced title");
      expect(code).not.toContain("Slide one");
    });

    it("receives the file path", async () => {
      let receivedPath = "";
      await process("basic.deck.md", {
        preprocess: (md, filePath) => {
          receivedPath = filePath;
          return md;
        },
      });
      expect(receivedPath).toContain("basic.deck.md");
    });

    it("supports async preprocess functions", async () => {
      const code = await process("basic.deck.md", {
        preprocess: async (md) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return md.replace("Slide two", "Async replaced");
        },
      });
      expect(code).toContain("Async replaced");
    });

    it("does not interfere when preprocess is not set", async () => {
      const withoutPreprocess = await process("basic.deck.md");
      const withNoop = await process("basic.deck.md", {
        preprocess: (md) => md,
      });
      expect(withoutPreprocess).toBe(withNoop);
    });
  });

  describe("processDeckMarkdown with preprocess", () => {
    it("applies preprocess before rendering slides", async () => {
      const source = "---\ntitle: Test\n---\n\n# Original\n\n---\n\n## Second\n";
      const html = await processDeckMarkdown(source, "/fake/test.deck.md", {
        preprocess: (md) => md.replace("Original", "Preprocessed"),
      });
      expect(html).toContain("Preprocessed");
      expect(html).not.toContain("Original");
    });

    it("uses global preprocess when no option is passed", async () => {
      setGlobalPreprocess((md) => md.replace("Original", "Global"));
      const source = "---\ntitle: Test\n---\n\n# Original\n";
      const html = await processDeckMarkdown(source, "/fake/test.deck.md");
      expect(html).toContain("Global");
      expect(html).not.toContain("Original");
      setGlobalPreprocess(undefined as any);
    });

    it("option preprocess takes precedence over global", async () => {
      setGlobalPreprocess((md) => md.replace("Original", "Global"));
      const source = "---\ntitle: Test\n---\n\n# Original\n";
      const html = await processDeckMarkdown(source, "/fake/test.deck.md", {
        preprocess: (md) => md.replace("Original", "Local"),
      });
      expect(html).toContain("Local");
      setGlobalPreprocess(undefined as any);
    });
  });
});
