// Secrets (set with `wrangler secret put`). Optional ones enable extra providers/retrievers.
interface Env {
  ADMIN_TOKEN?: string;
  APIFY_TOKEN?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
}
