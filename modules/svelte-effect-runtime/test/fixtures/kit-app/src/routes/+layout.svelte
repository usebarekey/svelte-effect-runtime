<script lang="ts">
  import { SvelteRuntime } from "ser/client";

  let { children } = $props();

  SvelteRuntime.make();
</script>

{@render children()}
