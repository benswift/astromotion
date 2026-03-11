import { parse } from "yaml";

interface DeckFrontmatter {
  title?: string;
  description?: string;
  author?: string;
  image?: string;
}

interface DeckMeta {
  data: DeckFrontmatter;
  content: string;
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n/;

export function parseDeckFrontmatter(raw: string, slug?: string): DeckMeta {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    return {
      data: { title: slug },
      content: raw,
    };
  }

  const data = parse(match[1]) as DeckFrontmatter;
  if (!data.title && slug) {
    data.title = slug;
  }
  const content = raw.slice(match[0].length);

  return { data, content };
}
