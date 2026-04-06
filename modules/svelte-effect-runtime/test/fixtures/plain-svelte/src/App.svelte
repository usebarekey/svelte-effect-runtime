<script lang="ts">
  import { SvelteRuntime } from "ser/client";
  import Counter from "./Counter.svelte";

  SvelteRuntime.make();
</script>

<main>
  <h1>plain smoke</h1>
  <Counter />
</main>
