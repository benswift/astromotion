import { describe, it, expect } from "vitest";
import { extractBgImagesFromAst, replaceQrImagesInAst } from "../src/preprocessor.ts";
import type { RootContent, Paragraph, Image, Html } from "mdast";

function makeImageParagraph(alt: string, url: string): Paragraph {
  return {
    type: "paragraph",
    children: [{ type: "image", alt, url, title: null } as Image],
  };
}

function makeTextParagraph(text: string): Paragraph {
  return {
    type: "paragraph",
    children: [{ type: "text", value: text }],
  };
}

describe("extractBgImagesFromAst", () => {
  it("extracts full-bleed background images", () => {
    const nodes: RootContent[] = [
      makeImageParagraph("bg", "photo.jpg"),
      makeTextParagraph("content"),
    ];
    const { images, remaining } = extractBgImagesFromAst(nodes);
    expect(images).toHaveLength(1);
    expect(images[0].url).toBe("photo.jpg");
    expect(remaining).toHaveLength(1);
  });

  it("extracts right-split background images", () => {
    const nodes: RootContent[] = [
      makeImageParagraph("bg right:40%", "side.jpg"),
    ];
    const { images } = extractBgImagesFromAst(nodes);
    expect(images[0].position).toBe("right");
    expect(images[0].splitPercent).toBe("40%");
  });

  it("extracts left-split background images", () => {
    const nodes: RootContent[] = [
      makeImageParagraph("bg left:60%", "left.jpg"),
    ];
    const { images } = extractBgImagesFromAst(nodes);
    expect(images[0].position).toBe("left");
    expect(images[0].splitPercent).toBe("60%");
  });

  it("extracts cover size modifier", () => {
    const nodes: RootContent[] = [
      makeImageParagraph("bg cover", "photo.jpg"),
    ];
    const { images } = extractBgImagesFromAst(nodes);
    expect(images[0].size).toBe("cover");
  });

  it("extracts contain size modifier", () => {
    const nodes: RootContent[] = [
      makeImageParagraph("bg contain", "photo.jpg"),
    ];
    const { images } = extractBgImagesFromAst(nodes);
    expect(images[0].size).toBe("contain");
  });

  it("extracts filter modifiers", () => {
    const nodes: RootContent[] = [
      makeImageParagraph("bg brightness:0.5 blur:2px", "photo.jpg"),
    ];
    const { images } = extractBgImagesFromAst(nodes);
    expect(images[0].filters).toBe("blur(2px) brightness(0.5)");
  });

  it("does not extract non-bg images", () => {
    const nodes: RootContent[] = [
      makeImageParagraph("photo", "regular.jpg"),
      makeTextParagraph("text"),
    ];
    const { images, remaining } = extractBgImagesFromAst(nodes);
    expect(images).toHaveLength(0);
    expect(remaining).toHaveLength(2);
  });

  it("handles multiple bg images in one slide", () => {
    const nodes: RootContent[] = [
      makeImageParagraph("bg", "full.jpg"),
      makeImageParagraph("bg right:30%", "side.jpg"),
      makeTextParagraph("content"),
    ];
    const { images, remaining } = extractBgImagesFromAst(nodes);
    expect(images).toHaveLength(2);
    expect(remaining).toHaveLength(1);
  });
});

describe("replaceQrImagesInAst", () => {
  it("replaces qr images with SVG HTML nodes", () => {
    const nodes: RootContent[] = [
      makeImageParagraph("qr", "https://example.com"),
    ];
    const result = replaceQrImagesInAst(nodes);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("html");
    expect((result[0] as Html).value).toContain("qr-code");
    expect((result[0] as Html).value).toContain("example.com");
  });

  it("leaves non-qr images unchanged", () => {
    const original = makeImageParagraph("photo", "test.jpg");
    const result = replaceQrImagesInAst([original]);
    expect(result[0]).toBe(original);
  });

  it("leaves text paragraphs unchanged", () => {
    const original = makeTextParagraph("hello");
    const result = replaceQrImagesInAst([original]);
    expect(result[0]).toBe(original);
  });
});
