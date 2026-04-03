import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseHTML } from "linkedom";
import { processDeckMarkdown } from "../src/vite-plugin.ts";

const FIXTURES = resolve(import.meta.dirname, "fixtures");

async function processFixture(name: string): Promise<Document> {
  const path = resolve(FIXTURES, name);
  const content = readFileSync(path, "utf-8");
  const html = await processDeckMarkdown(content, path);
  const { document } = parseHTML(`<div id="slides">${html}</div>`);
  return document;
}

function sections(doc: Document) {
  return doc.querySelectorAll("#slides > section");
}

describe("processDeckMarkdown HTML output", () => {
  describe("basic slide structure", () => {
    it("produces the correct number of sections", async () => {
      const doc = await processFixture("basic.deck.md");
      expect(sections(doc)).toHaveLength(3);
    });

    it("renders markdown headings inside sections", async () => {
      const doc = await processFixture("basic.deck.md");
      const secs = sections(doc);
      expect(secs[0].querySelector("h1")?.textContent).toBe("Slide one");
      expect(secs[1].querySelector("h2")?.textContent).toBe("Slide two");
    });

    it("renders markdown paragraphs inside sections", async () => {
      const doc = await processFixture("basic.deck.md");
      const secs = sections(doc);
      expect(secs[0].querySelector("p")?.textContent).toBe("Some content here.");
      expect(secs[1].querySelector("p")?.textContent).toBe("More content.");
    });

    it("does not contain Svelte or animotion artifacts", async () => {
      const doc = await processFixture("basic.deck.md");
      const html = doc.getElementById("slides")!.innerHTML;
      expect(html).not.toContain("<Slide");
      expect(html).not.toContain("<Presentation");
      expect(html).not.toContain("@animotion");
      expect(html).not.toContain("getPresentation");
      expect(html).not.toContain("{@html");
      expect(html).not.toContain("$effect");
    });

    it("does not contain JS module syntax", async () => {
      const doc = await processFixture("basic.deck.md");
      const html = doc.getElementById("slides")!.innerHTML;
      expect(html).not.toMatch(/\bimport\s/);
      expect(html).not.toMatch(/\bexport\s/);
    });

    it("every section is properly closed", async () => {
      const doc = await processFixture("basic.deck.md");
      const html = doc.getElementById("slides")!.innerHTML;
      const opens = (html.match(/<section/g) || []).length;
      const closes = (html.match(/<\/section>/g) || []).length;
      expect(opens).toBe(closes);
    });
  });

  describe("metadata directives", () => {
    it("applies _class as a class attribute on the section", async () => {
      const doc = await processFixture("notes-and-classes.deck.md");
      const secs = sections(doc);
      expect(secs[0].classList.contains("banner")).toBe(true);
      expect(secs[1].classList.contains("centered")).toBe(true);
    });

    it("renders notes as a div.notes inside the section", async () => {
      const doc = await processFixture("notes-and-classes.deck.md");
      const notesDiv = doc.querySelector("section .notes");
      expect(notesDiv).not.toBeNull();
      expect(notesDiv?.tagName).toBe("DIV");
      expect(notesDiv?.textContent).toContain("Remember to explain this slowly");
    });

    it("strips metadata comments from output", async () => {
      const doc = await processFixture("notes-and-classes.deck.md");
      const html = doc.getElementById("slides")!.innerHTML;
      expect(html).not.toContain("<!-- _class:");
      expect(html).not.toContain("<!-- notes:");
    });

    it("plain slides have no class attribute", async () => {
      const doc = await processFixture("notes-and-classes.deck.md");
      const secs = sections(doc);
      expect(secs[2].getAttribute("class")).toBeFalsy();
    });
  });

  describe("background images", () => {
    it("generates slide-bg divs for full-bleed backgrounds", async () => {
      const doc = await processFixture("bg-images.deck.md");
      const bg = doc.querySelector(".slide-bg");
      expect(bg).not.toBeNull();
      expect(bg?.getAttribute("style")).toContain("https://example.com/photo.jpg");
      expect(bg?.getAttribute("style")).toContain("background-size: cover");
    });

    it("generates split-layout for positioned backgrounds", async () => {
      const doc = await processFixture("bg-images.deck.md");
      const layout = doc.querySelector(".split-layout");
      expect(layout).not.toBeNull();
      const image = layout?.querySelector(".split-image");
      const content = layout?.querySelector(".split-content");
      expect(image).not.toBeNull();
      expect(content).not.toBeNull();
    });

    it("sets correct split percentages", async () => {
      const doc = await processFixture("bg-images.deck.md");
      const splitImage = doc.querySelector(".split-image");
      expect(splitImage?.getAttribute("style")).toContain("width: 40%");
      const splitContent = doc.querySelector(".split-content");
      expect(splitContent?.getAttribute("style")).toContain("calc(100% - 40%)");
    });

    it("applies brightness and blur filters", async () => {
      const doc = await processFixture("bg-images.deck.md");
      const secs = sections(doc);
      const filteredBg = secs[2].querySelector(".slide-bg");
      const style = filteredBg?.getAttribute("style") ?? "";
      expect(style).toContain("brightness(0.5)");
      expect(style).toContain("blur(2px)");
    });

    it("does not leave bg image markdown in slide content", async () => {
      const doc = await processFixture("bg-images.deck.md");
      const html = doc.getElementById("slides")!.innerHTML;
      expect(html).not.toContain("![bg");
    });
  });

  describe("saturate and combined filters", () => {
    it("applies saturate filter", async () => {
      const doc = await processFixture("all-filters.deck.md");
      const bg = sections(doc)[0].querySelector(".slide-bg");
      expect(bg?.getAttribute("style")).toContain("saturate(1.5)");
    });

    it("combines multiple filters in one declaration", async () => {
      const doc = await processFixture("all-filters.deck.md");
      const bg = sections(doc)[1].querySelector(".slide-bg");
      const style = bg?.getAttribute("style") ?? "";
      expect(style).toContain("brightness(0.8)");
      expect(style).toContain("saturate(0.5)");
      expect(style).toContain("blur(1px)");
    });
  });

  describe("code blocks", () => {
    it("produces shiki-highlighted pre elements", async () => {
      const doc = await processFixture("code-blocks.deck.md");
      const pre = doc.querySelector("pre.shiki");
      expect(pre).not.toBeNull();
      expect(pre?.querySelector("code")).not.toBeNull();
    });

    it("does not use animotion Code component", async () => {
      const doc = await processFixture("code-blocks.deck.md");
      const html = doc.getElementById("slides")!.innerHTML;
      expect(html).not.toContain("<Code");
    });

    it("preserves code content in highlighted output", async () => {
      const doc = await processFixture("code-blocks.deck.md");
      const codeText = doc.querySelector("pre.shiki code")?.textContent ?? "";
      expect(codeText).toContain("42");
    });

    it("renders surrounding text alongside code blocks", async () => {
      const doc = await processFixture("code-blocks.deck.md");
      const secs = sections(doc);
      const secondSlide = secs[1];
      expect(secondSlide.querySelector("p")?.textContent).toBe("Some text before.");
      const allPs = secondSlide.querySelectorAll("p");
      expect(allPs[allPs.length - 1]?.textContent).toBe("Some text after.");
    });
  });

  describe("includes", () => {
    it("inlines included content into correct number of slides", async () => {
      const doc = await processFixture("with-includes.deck.md");
      expect(sections(doc)).toHaveLength(5);
    });

    it("renders content from included files", async () => {
      const doc = await processFixture("with-includes.deck.md");
      const allText = doc.getElementById("slides")!.textContent ?? "";
      expect(allText).toContain("Lesson A: First slide");
      expect(allText).toContain("Content from lesson A");
      expect(allText).toContain("Lesson B");
    });

    it("does not include the @include directive in output", async () => {
      const doc = await processFixture("with-includes.deck.md");
      const html = doc.getElementById("slides")!.innerHTML;
      expect(html).not.toContain("@include");
    });
  });

  describe("smartypants typography", () => {
    it("converts straight double quotes to smart quotes", async () => {
      const doc = await processFixture("typography.deck.md");
      const text = sections(doc)[0].textContent ?? "";
      expect(text).toContain("\u201C");
      expect(text).toContain("\u201D");
    });

    it("converts straight apostrophes to curly", async () => {
      const doc = await processFixture("typography.deck.md");
      const text = sections(doc)[0].textContent ?? "";
      expect(text).toContain("\u2019");
    });

    it("converts triple dashes to em dashes", async () => {
      const doc = await processFixture("typography.deck.md");
      const text = sections(doc)[0].textContent ?? "";
      expect(text).toContain("\u2014");
    });

    it("converts triple dots to ellipsis", async () => {
      const doc = await processFixture("typography.deck.md");
      const text = sections(doc)[1].textContent ?? "";
      expect(text).toContain("\u2026");
    });
  });

  describe("QR codes", () => {
    it("replaces ![qr](url) with an SVG QR code", async () => {
      const doc = await processFixture("qr-and-logo.deck.md");
      const qrDiv = sections(doc)[0].querySelector(".qr-code");
      expect(qrDiv).not.toBeNull();
      const svg = qrDiv?.querySelector("svg");
      expect(svg).not.toBeNull();
    });

    it("includes the URL as a link below the QR code", async () => {
      const doc = await processFixture("qr-and-logo.deck.md");
      const link = sections(doc)[0].querySelector(".qr-code a");
      expect(link).not.toBeNull();
      expect(link?.getAttribute("href")).toBe("https://example.com");
    });
  });

  describe("logo slides", () => {
    it("generates SVG for anu-logo class", async () => {
      const doc = await processFixture("qr-and-logo.deck.md");
      const anuSlide = sections(doc)[1];
      expect(anuSlide.classList.contains("anu-logo")).toBe(true);
      expect(anuSlide.querySelector("svg")).not.toBeNull();
    });

    it("generates SVG for socy-logo class", async () => {
      const doc = await processFixture("qr-and-logo.deck.md");
      const socySlide = sections(doc)[2];
      expect(socySlide.classList.contains("socy-logo")).toBe(true);
      expect(socySlide.querySelector("svg")).not.toBeNull();
    });
  });

  describe("edge cases", () => {
    it("handles deck with script/style blocks without crashing", async () => {
      const doc = await processFixture("with-script.deck.md");
      expect(sections(doc).length).toBeGreaterThanOrEqual(2);
    });

    it("ignores script and style blocks in HTML output", async () => {
      const doc = await processFixture("with-script.deck.md");
      const html = doc.getElementById("slides")!.innerHTML;
      expect(html).not.toContain("<script");
      expect(html).not.toContain("const name");
    });
  });
});
