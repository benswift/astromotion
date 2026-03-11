// @animotion/core's Transition component imports $app/environment (a SvelteKit
// module) to check if it's running in the browser. Since we use Astro, not
// SvelteKit, we alias $app/environment to this shim via the integration.
// Decks are always rendered with client:only="svelte", so browser is always true.
export const browser = true;
export const building = false;
export const dev = false;
export const version = "";
