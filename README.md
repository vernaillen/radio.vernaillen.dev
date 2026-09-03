# radio.vernaillen.dev

A convenient way to listen to my favorite radio stations, with a real-time
spectrum visualizer. Built for my own use, but feel free to use it if you want.

30 stations — Belgian public radio (Radio 1, StuBru, Urgent.fm, …), a handful of
French and Austrian ones, and 9 SomaFM channels — picked from a grid of station
tiles. Filter chips above the grid (VRT, SomaFM, FIP, Rock, Chill, …) narrow it
down to one network or mood, and the choice is remembered in localStorage.
Installable as a PWA.

## Stack

Nuxt 4 · @nuxt/ui v4 · Tailwind v4 · `@fft-visualizer/vue` (Rust/WASM FFT) ·
`@vite-pwa/nuxt`. Runs as a Nitro node server.

## How it works

**Everything streams through `/api/radio?station=<key>`** rather than straight
into the `<audio>` element (`server/api/radio.get.ts`). Two reasons:

1. Some origins reject browsers outright — SomaFM 403s any request carrying a
   `Range` header, and browsers always send `Range: bytes=0-` on a media fetch.
2. Same-origin media is never CORS-tainted, so WebAudio is allowed to read the
   samples. That is the whole point: the visualizer only reacts to audio it can
   read.

As a bonus it lets plain-HTTP and non-standard-port upstreams work without a
mixed-content error, since the browser never sees those URLs.

The proxy uses Node's core `http`/`https` client with `insecureHTTPParser: true`
instead of `fetch`. Icecast/SHOUTcast servers are older than the spec undici
holds them to — several answer with a status line it rejects outright ("Missing
expected CR after response line") — so `fetch` threw before a byte of audio
arrived. The lenient parser is the one curl and every media player already use.
Redirects are followed by hand, because the core client doesn't.

**The visualizer is fed from the audio graph, not by the component**
(`components/fftPlayer.ts`). `createMediaElementSource` → `ChannelSplitter(2)` →
two `AnalyserNode`s → two WASM `FftProcessor`s, so the stereo presets render a
real L/R image rather than a mirrored mono spectrum.

Two things there are load-bearing and easy to break:

- The `AudioContext` must be constructed **and** the element played
  synchronously inside the click, or the autoplay policy leaves the context
  suspended. Load the WASM only after the graph is wired, never before.
- `@fft-visualizer/vue/wasm` is bundled with `vite-plugin-top-level-await`:
  `await import(…)` resolves while its exports are still `undefined`. You must
  `await mod.__tla` before touching `FftProcessor`, and must not destructure
  before that await.

`shared/channels.ts` is the single source of truth for the station list, shared
by the browser UI and the proxy so both agree on what `?station=` means. Logos
are hosted locally under `public/images/stations/` (28 of 30; the rest fall back
to initials on the tile). It also carries each station's filter tags and the
list of filter chips, so the tag union type is derived from that list and a typo
fails `pnpm typecheck`.

## Development

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Note: editing `components/fftPlayer.ts` needs a hard reload (Cmd+Shift+R) —
`RadioPlayer.vue` grabs the `createRadioAudio` closure once at setup, so an HMR
patch of that module won't take. Server route changes need a dev-server restart.

```bash
pnpm lint:fix
pnpm typecheck
pnpm check        # prepare + lint + typecheck + build, same as CI
```

## Deployment

Push to `main` → the `ci` workflow runs `pnpm check`, builds the production
image, boots it and smoke-tests `:3000`, then pushes
`registry.apps.vernaillen.dev/radio-vernaillen-dev:{latest,<sha>}` and triggers
the Coolify redeploy.

Repo secrets: `REGISTRY_USERNAME`, `REGISTRY_PASSWORD`, and `COOLIFY_DEPLOY_URL`
+ `COOLIFY_TOKEN` (the redeploy step skips cleanly while those two are unset).

`/api/radio` is also the stream source for the FFT visualizer demo on
[vernaillen.dev](https://vernaillen.dev) — with no `?station=`, it serves SomaFM
Groove Salad Classic. Don't repoint that default.
