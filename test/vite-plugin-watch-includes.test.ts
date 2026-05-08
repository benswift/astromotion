import { describe, it, expect, vi } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { viteDeckWatchIncludes } from "../src/vite-plugin-watch-includes.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fixturesDir = path.join(__dirname, "fixtures");
const partialPath = path.join(fixturesDir, "includes", "partial.mdx");
const mainPath = path.join(fixturesDir, "includes", "main.mdx");

function callTransform(code: string, id: string) {
  const plugin = viteDeckWatchIncludes();
  const addWatchFile = vi.fn();
  plugin.transform.call({ addWatchFile }, code, id);
  return addWatchFile;
}

describe("viteDeckWatchIncludes", () => {
  it("registers a single include as a watch file", () => {
    const id = path.join(fixturesDir, "main.deck.mdx");
    const code = "# Header\n\n{/* @include ./includes/partial.mdx */}\n";
    const addWatchFile = callTransform(code, id);
    expect(addWatchFile).toHaveBeenCalledWith(partialPath);
  });

  it("recurses into nested includes", () => {
    const id = path.join(fixturesDir, "wrapper.deck.mdx");
    const code = "{/* @include ./includes/main.mdx */}\n";
    const addWatchFile = callTransform(code, id);
    expect(addWatchFile).toHaveBeenCalledWith(mainPath);
    expect(addWatchFile).toHaveBeenCalledWith(partialPath);
  });

  it("does not register watch files for non-.deck.mdx ids", () => {
    const id = path.join(fixturesDir, "ordinary.md");
    const code = "{/* @include ./includes/partial.mdx */}\n";
    const addWatchFile = callTransform(code, id);
    expect(addWatchFile).not.toHaveBeenCalled();
  });

  it("strips query suffix from id when resolving", () => {
    const id = path.join(fixturesDir, "main.deck.mdx") + "?import";
    const code = "{/* @include ./includes/partial.mdx */}\n";
    const addWatchFile = callTransform(code, id);
    expect(addWatchFile).toHaveBeenCalledWith(partialPath);
  });

  it("ignores non-.mdx include paths", () => {
    const id = path.join(fixturesDir, "main.deck.mdx");
    const code = "{/* @include ./includes/partial.md */}\n";
    const addWatchFile = callTransform(code, id);
    expect(addWatchFile).not.toHaveBeenCalled();
  });

  it("does not throw when an included file is missing", () => {
    const id = path.join(fixturesDir, "main.deck.mdx");
    const code = "{/* @include ./does-not-exist.mdx */}\n";
    expect(() => callTransform(code, id)).not.toThrow();
  });

  it("registers nothing for a deck with no include directives", () => {
    const id = path.join(fixturesDir, "main.deck.mdx");
    const code = "# Heading\n\nSome body text without directives.\n";
    const addWatchFile = callTransform(code, id);
    expect(addWatchFile).not.toHaveBeenCalled();
  });

  it("does not double-register the same include", () => {
    const id = path.join(fixturesDir, "main.deck.mdx");
    const code =
      "{/* @include ./includes/partial.mdx */}\n\n" + "{/* @include ./includes/partial.mdx */}\n";
    const addWatchFile = callTransform(code, id);
    const partialCalls = addWatchFile.mock.calls.filter((c) => c[0] === partialPath);
    expect(partialCalls).toHaveLength(1);
  });
});
