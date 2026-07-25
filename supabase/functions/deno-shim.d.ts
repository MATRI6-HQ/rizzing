// Local-typecheck shim ONLY — never imported, never bundled, never deployed.
//
// The Edge Functions run on Deno, but there's no Deno toolchain on this machine. This
// declares just enough of the runtime for `npm run typecheck:functions` to typecheck the
// function bodies with plain tsc. It caught nothing the day it was written; it exists so
// a broken provider signature or backoff type fails locally instead of on deploy.
declare const Deno: {
  env: { get(k: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  // Shape is irrelevant here — the function only chains .from().select().eq().
  export function createClient(url: string, key: string, opts?: unknown): any
}
