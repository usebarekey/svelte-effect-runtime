<script lang="ts">
  import { ClientRuntime } from "ser";
  import Counter from "./Counter.svelte";

  ClientRuntime.make();
</script>

<main>
  <h1>plain smoke</h1>
  <Counter />
</main>
