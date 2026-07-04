---
name: afiliados-widget-sdk
description: >
  Build, pack, preview, and publish standalone widget dists with the
  `kp-widget` CLI (afiliados-widget-sdk) — for widgets uploaded to
  KingPanda-Lab/afiliados' /admin/widgets (WidgetDist) or the standalone
  [KP]/widgets platform. Use when scaffolding a new widget, editing
  widget.config.json, or deciding whether a widget needs a per-affiliate
  link. KEY GUIDELINE: if the widget reads `?aff=&dest=&mode=` from its own
  URL (location.search) to build a tracked link — same contract as
  qrcode/rotator — declare `"perAffiliate": true` in widget.config.json.
  Don't leave this to be set manually at upload time; the widget's author
  is the only one who actually knows whether it needs this, not whoever
  uploads it later.
---

# afiliados-widget-sdk

CLI (`kp-widget`) that builds a self-contained static widget bundle (Vite +
React, relative asset paths — portable, not tied to where it's served from)
from a `<id>/` source folder, and packs it into a zip ready for upload.

## Commands

```
kp-widget create  <id>                          scaffold ./<id> (index.html + main.tsx)
kp-widget build   <id> [--src dir] [--out dir]   -> dist/<id>
kp-widget pack    <id> [--dir dir]               -> <id>.zip (index.html at root)
kp-widget preview <id> [--dir dir] [--port n]    static local server (no live-data endpoints)
kp-widget publish <id> --url <server> --password <senha>   (standalone widgets server only)
```

## The widget's contract (main.tsx)

- Self-contained: no imports outside its own folder (needed for `pack` to zip it correctly).
- Talks directly to whatever backend hosts it — relative `fetch`/`EventSource` calls
  (e.g. `/api/widgets/jackpot/stream`, `/api/widgets/minigames/*` in afiliados). The SDK
  does not know or care what these calls are — see "who needs to know about who" below.
- Derives any proxy base from `location.pathname`/`location.search` at runtime, never
  hardcoded — same bytes work wherever the dist ends up being served.
- **Never inline a large asset (e.g. base64 image) directly in `index.html`.** In afiliados,
  `index.html` is the one file in a dist served without streaming (the server buffers it
  whole to inject `<base href>`); everything else streams. A normal `index.html` (few KB)
  is fine, but a big inline base64 turns it into the same kind of synchronous buffering
  burst that stalls hard under prod Kubernetes CPU throttling (confirmed live: a 161KB JS
  file buffered took ~10s in prod vs ~0.1s streamed — `index.html` was always fast
  specifically because it stays small). Always import large assets normally so Vite hashes
  and separates them.

## `widget.config.json` (optional, in the source folder)

```json
{
  "title": "Meu widget",
  "description": "O que ele faz.",
  "proxy": { "http": "https://meu-upstream.com", "auth": "rewards-jwt" },
  "perAffiliate": false,
  "scenes": [
    { "key": "jackpot", "label": "Ticker Jackpot", "defaultDwellMs": 15000 },
    { "key": "arena", "label": "Rank Arena (por período)", "defaultDwellMs": 8000 },
    { "key": "qr", "label": "QR", "defaultDwellMs": 15000 }
  ]
}
```

`build` reads this and emits `dist/<id>/widget.json` — the manifest the dist carries with
it. Admin upload UIs can read this manifest to auto-fill metadata instead of requiring
someone to re-enter it by hand.

### `perAffiliate` — declare this, don't guess it later

Set `true` if the widget reads `?aff=&dest=&mode=` from its own URL (`location.search`) to
build a per-affiliate tracked link — exactly the contract `qrcode` and `rotator` (the QR
scene) already use in `afiliados`. This decides whether the URL a portal/admin generates
for the widget includes those query params or is a flat link (like `jackpot`/`arena`,
which are generic — same data for every viewer).

**Why this belongs in the manifest, not a checkbox filled in at upload time:** the person
uploading a widget isn't necessarily the person who wrote it, and can't reliably know
whether it needs `?aff=` without reading the source. The widget's author already knows —
declare it once, here, and every upload UI that reads the manifest gets it right
automatically, no reminder needed.

### `scenes` — only for widgets that compose timed sub-scenes

Declare this only if the widget internally cycles multiple sub-scenes with their own
duration — the `rotator` is the only current example (jackpot → arena periods → QR).
Each `{key, label, defaultDwellMs}` lets the host's admin panel render a timing slider per
scene without hardcoding in advance which scenes (or how many) the bundle has. `key` must
match whatever the bundle itself expects back from its config endpoint; `label` is
display-only; `defaultDwellMs` seeds the value before an admin ever touches it. Omit the
field entirely for widgets with no sub-scenes (the common case).

## Who needs to know about who (architecture note)

- **SDK ↔ upload endpoint**: share only a thin packaging contract (zip with `index.html`
  at root, safe id, size cap). The SDK never needs to know which server hosts the dist or
  what its API routes are.
- **Server (afiliados/widgets)**: knows the packaging contract and its own API routes —
  has zero visibility into which of them a given widget's JS actually calls.
- **The widget's own source** is the only thing coupled to a specific backend's API, and
  that coupling is written by hand — normal frontend code calling normal endpoints. No
  tool infers or standardizes this; `widget.config.json` only describes the widget's own
  *shape* (title, description, whether it needs a per-affiliate URL), never the backend
  it happens to call.
