<script lang="ts">
  import type { Component } from "svelte";

  interface Props {
    deckPath: string;
  }

  const { deckPath }: Props = $props();

  const modules = import.meta.glob<{ default: Component }>("/src/decks/**/*.deck.svelte");

  let Deck: Component | undefined = $state();

  $effect(() => {
    const loader = modules[deckPath];
    loader?.().then((m) => { Deck = m.default; });
  });
</script>

{#if Deck}
  <Deck />
{/if}
