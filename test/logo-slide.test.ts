import { describe, it, expect } from "vitest";
import { generateLogoSlide } from "../src/svg/logo-slide.ts";

describe("generateLogoSlide", () => {
  it("generates an SVG with 1280x720 viewBox for anu variant", () => {
    const result = generateLogoSlide("anu");
    expect(result).toContain('viewBox="0 0 1280 720"');
  });

  it("generates an SVG with 1280x720 viewBox for socy variant", () => {
    const result = generateLogoSlide("socy");
    expect(result).toContain('viewBox="0 0 1280 720"');
  });

  it("includes logo-svg class", () => {
    const result = generateLogoSlide("anu");
    expect(result).toContain('class="logo-svg"');
  });

  it("includes logo-group with transform for anu", () => {
    const result = generateLogoSlide("anu");
    expect(result).toContain('class="logo-group"');
    expect(result).toContain("translate(230, 287) scale(2)");
  });

  it("includes logo-group with transform for socy", () => {
    const result = generateLogoSlide("socy");
    expect(result).toContain('class="logo-group"');
    expect(result).toContain("scale(1.5)");
  });

  it("prefixes CSS classes with anu- for anu variant", () => {
    const result = generateLogoSlide("anu");
    expect(result).not.toMatch(/(?<!anu-)cls-/);
  });

  it("prefixes CSS classes with socy- for socy variant", () => {
    const result = generateLogoSlide("socy");
    expect(result).not.toMatch(/(?<!socy-)cls-/);
  });

  it("includes gold vertical rule rects", () => {
    const result = generateLogoSlide("anu");
    expect(result).toContain('class="logo-rule-top"');
    expect(result).toContain('class="logo-rule-bottom"');
    expect(result).toContain('fill="#be830e"');
  });
});
