import { describe, it, expect } from "vitest";
import {
  parseHtmlComment,
  parseCommentDirective,
  parseClassDirective,
  parseNotesDirective,
  parseIncludeDirective,
  isHtmlTagStart,
  extractScriptContent,
  extractFrontmatter,
  parseBgModifiers,
  findRelativeImgSrcs,
} from "../src/parse-helpers.ts";

describe("parseHtmlComment", () => {
  it("extracts body from a standard comment", () => {
    expect(parseHtmlComment("<!-- hello -->")).toBe("hello");
  });

  it("trims internal whitespace", () => {
    expect(parseHtmlComment("<!--  spaced  -->")).toBe("spaced");
  });

  it("handles surrounding whitespace on the string", () => {
    expect(parseHtmlComment("  <!-- trimmed -->  ")).toBe("trimmed");
  });

  it("returns null for non-comment HTML", () => {
    expect(parseHtmlComment("<div>hello</div>")).toBeNull();
  });

  it("returns null for incomplete opening", () => {
    expect(parseHtmlComment("<!- not a comment -->")).toBeNull();
  });

  it("returns null for missing closing", () => {
    expect(parseHtmlComment("<!-- unclosed")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseHtmlComment("")).toBeNull();
  });

  it("handles comment with only whitespace body", () => {
    expect(parseHtmlComment("<!--   -->")).toBe("");
  });

  it("preserves colons and special characters in body", () => {
    expect(parseHtmlComment("<!-- key: value -->")).toBe("key: value");
  });
});

describe("parseCommentDirective", () => {
  it("extracts value for a matching directive", () => {
    expect(parseCommentDirective("<!-- _class: banner -->", "_class")).toBe("banner");
  });

  it("returns null when directive does not match", () => {
    expect(parseCommentDirective("<!-- notes: stuff -->", "_class")).toBeNull();
  });

  it("returns null for non-comment HTML", () => {
    expect(parseCommentDirective("<div>test</div>", "_class")).toBeNull();
  });

  it("returns null for empty value after directive", () => {
    expect(parseCommentDirective("<!-- _class: -->", "_class")).toBeNull();
  });

  it("trims value whitespace", () => {
    expect(parseCommentDirective("<!--  _class:  banner  -->", "_class")).toBe("banner");
  });
});

describe("parseClassDirective", () => {
  it("extracts class name", () => {
    expect(parseClassDirective("<!-- _class: banner -->")).toBe("banner");
  });

  it("extracts multiple class names", () => {
    expect(parseClassDirective("<!-- _class: banner centered -->")).toBe("banner centered");
  });

  it("returns null for non-class comments", () => {
    expect(parseClassDirective("<!-- notes: hello -->")).toBeNull();
  });

  it("handles extra whitespace", () => {
    expect(parseClassDirective("<!--  _class:  impact  -->")).toBe("impact");
  });
});

describe("parseNotesDirective", () => {
  it("extracts notes content", () => {
    expect(parseNotesDirective("<!-- notes: Remember this -->")).toBe("Remember this");
  });

  it("returns null for non-notes comments", () => {
    expect(parseNotesDirective("<!-- _class: banner -->")).toBeNull();
  });

  it("preserves internal content", () => {
    expect(parseNotesDirective("<!-- notes: line one, line two -->")).toBe("line one, line two");
  });
});

describe("parseIncludeDirective", () => {
  it("extracts file path", () => {
    expect(parseIncludeDirective("<!-- @include slides/intro.md -->")).toBe("slides/intro.md");
  });

  it("returns null for non-include comments", () => {
    expect(parseIncludeDirective("<!-- _class: banner -->")).toBeNull();
  });

  it("returns null for non-comment HTML", () => {
    expect(parseIncludeDirective("<div>test</div>")).toBeNull();
  });

  it("returns null for empty path", () => {
    expect(parseIncludeDirective("<!-- @include  -->")).toBeNull();
  });

  it("extracts only the first token as path", () => {
    expect(parseIncludeDirective("<!-- @include file.md extra -->")).toBe("file.md");
  });

  it("handles relative paths", () => {
    expect(parseIncludeDirective("<!-- @include ../shared/topic.md -->")).toBe("../shared/topic.md");
  });
});

describe("isHtmlTagStart", () => {
  it("matches tag with attributes", () => {
    expect(isHtmlTagStart('<script lang="ts">', "script")).toBe(true);
  });

  it("matches self-closing style", () => {
    expect(isHtmlTagStart("<script>", "script")).toBe(true);
  });

  it("matches style tags", () => {
    expect(isHtmlTagStart("<style>body{}</style>", "style")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isHtmlTagStart("<SCRIPT>", "script")).toBe(true);
  });

  it("does not match different tag", () => {
    expect(isHtmlTagStart("<div>", "script")).toBe(false);
  });

  it("does not match partial tag name", () => {
    expect(isHtmlTagStart("<scripting>", "script")).toBe(false);
  });

  it("does not match non-HTML", () => {
    expect(isHtmlTagStart("just text", "script")).toBe(false);
  });

  it("handles leading whitespace", () => {
    expect(isHtmlTagStart("  <script>", "script")).toBe(true);
  });
});

describe("extractScriptContent", () => {
  it("extracts attrs and body from a script tag", () => {
    const result = extractScriptContent('<script lang="ts">const x = 1;</script>');
    expect(result).toEqual({ attrs: ' lang="ts"', body: "const x = 1;" });
  });

  it("extracts from plain script tag", () => {
    const result = extractScriptContent("<script>code()</script>");
    expect(result).toEqual({ attrs: "", body: "code()" });
  });

  it("handles multiline body", () => {
    const result = extractScriptContent("<script>\n  line1\n  line2\n</script>");
    expect(result?.body).toBe("\n  line1\n  line2\n");
  });

  it("returns null when no script tag", () => {
    expect(extractScriptContent("<div>hello</div>")).toBeNull();
  });

  it("returns null for unclosed script", () => {
    expect(extractScriptContent("<script>code")).toBeNull();
  });
});

describe("extractFrontmatter", () => {
  it("extracts frontmatter and content", () => {
    const result = extractFrontmatter("---\ntitle: Test\n---\n# Slide\n");
    expect(result).toEqual({ data: "title: Test", content: "# Slide\n" });
  });

  it("returns null when no frontmatter", () => {
    expect(extractFrontmatter("# Just markdown")).toBeNull();
  });

  it("handles frontmatter at end of file", () => {
    const result = extractFrontmatter("---\ntitle: T\n---");
    expect(result).toEqual({ data: "title: T", content: "" });
  });

  it("handles empty content after frontmatter", () => {
    const result = extractFrontmatter("---\ntitle: T\n---\n");
    expect(result).toEqual({ data: "title: T", content: "" });
  });

  it("handles multiline frontmatter", () => {
    const result = extractFrontmatter("---\ntitle: T\ndescription: D\nauthor: A\n---\ncontent");
    expect(result?.data).toBe("title: T\ndescription: D\nauthor: A");
    expect(result?.content).toBe("content");
  });

  it("returns null for incomplete frontmatter", () => {
    expect(extractFrontmatter("---\ntitle: T\nno closing")).toBeNull();
  });

  it("returns null when dashes not at start", () => {
    expect(extractFrontmatter("text\n---\ntitle: T\n---\n")).toBeNull();
  });
});

describe("parseBgModifiers", () => {
  it("returns empty object for empty string", () => {
    expect(parseBgModifiers("")).toEqual({});
  });

  it("parses left position with default split", () => {
    expect(parseBgModifiers(" left")).toEqual({ position: "left", splitPercent: "50%" });
  });

  it("parses left position with custom split", () => {
    expect(parseBgModifiers(" left:60%")).toEqual({ position: "left", splitPercent: "60%" });
  });

  it("parses right position with custom split", () => {
    expect(parseBgModifiers(" right:40%")).toEqual({ position: "right", splitPercent: "40%" });
  });

  it("parses cover size", () => {
    expect(parseBgModifiers(" cover")).toEqual({ size: "cover" });
  });

  it("parses contain size", () => {
    expect(parseBgModifiers(" contain")).toEqual({ size: "contain" });
  });

  it("parses blur filter", () => {
    expect(parseBgModifiers(" blur:2px")).toEqual({ filters: "blur(2px)" });
  });

  it("parses brightness filter", () => {
    expect(parseBgModifiers(" brightness:0.5")).toEqual({ filters: "brightness(0.5)" });
  });

  it("parses saturate filter", () => {
    expect(parseBgModifiers(" saturate:1.5")).toEqual({ filters: "saturate(1.5)" });
  });

  it("combines multiple filters in input order", () => {
    expect(parseBgModifiers(" brightness:0.5 blur:2px")).toEqual({
      filters: "brightness(0.5) blur(2px)",
    });
  });

  it("combines all three filters", () => {
    expect(parseBgModifiers(" saturate:0.5 brightness:0.8 blur:1px")).toEqual({
      filters: "saturate(0.5) brightness(0.8) blur(1px)",
    });
  });

  it("parses combined position and filters", () => {
    expect(parseBgModifiers(" left:40% blur:3px")).toEqual({
      position: "left",
      splitPercent: "40%",
      filters: "blur(3px)",
    });
  });

  it("ignores unknown tokens", () => {
    expect(parseBgModifiers(" unknown cover")).toEqual({ size: "cover" });
  });

  it("ignores filter keys without values", () => {
    expect(parseBgModifiers(" blur")).toEqual({});
  });
});

describe("findRelativeImgSrcs", () => {
  it("finds relative src with double quotes", () => {
    const result = findRelativeImgSrcs('<img src="./photo.jpg">');
    expect(result).toHaveLength(1);
    expect(result[0].src).toBe("./photo.jpg");
  });

  it("finds relative src with single quotes", () => {
    const result = findRelativeImgSrcs("<img src='../photo.jpg'>");
    expect(result).toHaveLength(1);
    expect(result[0].src).toBe("../photo.jpg");
  });

  it("ignores absolute URLs", () => {
    expect(findRelativeImgSrcs('<img src="https://example.com/photo.jpg">')).toHaveLength(0);
  });

  it("ignores root-relative paths", () => {
    expect(findRelativeImgSrcs('<img src="/images/photo.jpg">')).toHaveLength(0);
  });

  it("captures before and after content", () => {
    const result = findRelativeImgSrcs('<img class="hero" src="./photo.jpg" alt="test">');
    expect(result).toHaveLength(1);
    expect(result[0].before).toContain('class="hero"');
    expect(result[0].after).toContain('alt="test"');
  });

  it("finds multiple img tags", () => {
    const html = '<img src="./a.jpg"><p>text</p><img src="../b.png">';
    const result = findRelativeImgSrcs(html);
    expect(result).toHaveLength(2);
    expect(result[0].src).toBe("./a.jpg");
    expect(result[1].src).toBe("../b.png");
  });

  it("returns empty array for no img tags", () => {
    expect(findRelativeImgSrcs("<p>no images</p>")).toHaveLength(0);
  });

  it("returns correct start and end positions", () => {
    const html = "before<img src=\"./photo.jpg\">after";
    const result = findRelativeImgSrcs(html);
    expect(result).toHaveLength(1);
    expect(html.slice(result[0].start, result[0].end)).toBe('<img src="./photo.jpg">');
  });

  it("does not match data-src or other src-like attributes", () => {
    const result = findRelativeImgSrcs('<img data-src="./photo.jpg" src="https://cdn.example.com/img.jpg">');
    expect(result).toHaveLength(0);
  });
});
