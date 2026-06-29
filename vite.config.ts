// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Vercel deployment:
// - Inside the Lovable sandbox build, the preset is forced to Cloudflare (this override is ignored).
// - Outside Lovable (e.g. when the repo is cloned & deployed to Vercel), nitro is forced ON
//   with the `vercel` preset, producing `.vercel/output` (Build Output API v3) that Vercel auto-detects.
// - Vercel also auto-sets NITRO_PRESET=vercel, but pinning it here makes `bun run build`
//   produce a Vercel-ready bundle locally too.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: "vercel",
  },
});
