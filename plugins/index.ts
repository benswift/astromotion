import { remarkDeckIncludes } from "./remark-deck-includes.ts";
import { remarkDeckSections } from "./remark-deck-sections.ts";
import { remarkDeckClasses } from "./remark-deck-classes.ts";
import { remarkDeckNotes } from "./remark-deck-notes.ts";
import { remarkDeckQr } from "./remark-deck-qr.ts";
import { remarkDeckBg } from "./remark-deck-bg.ts";

export const deckRemarkPlugins = [
  remarkDeckIncludes,
  remarkDeckSections,
  remarkDeckClasses,
  remarkDeckNotes,
  remarkDeckQr,
  remarkDeckBg,
];

export {
  remarkDeckIncludes,
  remarkDeckSections,
  remarkDeckClasses,
  remarkDeckNotes,
  remarkDeckQr,
  remarkDeckBg,
};
