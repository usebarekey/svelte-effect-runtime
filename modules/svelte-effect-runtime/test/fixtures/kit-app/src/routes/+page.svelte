<script lang="ts" effect>
  import Counter from "./Counter.svelte";
  import {
    create_post,
    get_post,
    get_posts,
    get_static_post,
    square_post,
  } from "./posts.remote";

  let command_result = $state("");
  let form_body = $state("body");
  let form_title = $state("post");
  let post_title = $state("");
  let prerender_title = $state("");

  prerender_title = (yield* get_static_post("intro")).title;
</script>

<h1>kit smoke</h1>
<Counter />

<button onclick={() => command_result = String((yield* square_post(4)).value)}>
  command
</button>
<button onclick={() => post_title = (yield* get_post("alpha")).title}>
  query
</button>
<button onclick={() => post_title = (yield* get_posts("beta")).title}>
  batch
</button>

<form {...create_post}>
  <input {...create_post.fields.title.as("text")} bind:value={form_title} />
  <textarea {...create_post.fields.body.as("text")} bind:value={form_body}></textarea>
</form>

<button
  onclick={() =>
    yield* create_post.submit({
      body: form_body,
      title: form_title,
    })}
>
  form
</button>

<p>{command_result}</p>
<p>{post_title}</p>
<p>{prerender_title}</p>
