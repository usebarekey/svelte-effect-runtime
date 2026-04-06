<script lang="ts" effect>
  import { Effect } from "effect";

  let count = $state(0);
  count = yield* Effect.succeed(1);
</script>

<p>{count}</p>

