# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

Vashira is a decentralized, AI-augmented reference manager (a Zotero alternative) with a P2P layer that exchanges bibliographic **metadata only** — never files. This is a monorepo containing five independently-versioned sub-projects that share no build tooling but overlap in code/protocol:

| Directory | What it is | Tech |
|---|---|---|
| `vashira-app/` | The main product: an Electron desktop app | Electron + React (TSX) + better-sqlite3 |
| `vashira-node/` | Headless "Sovereign Hub" server for NAS/community deployments | Express, imports `vashira-app/src` directly via relative paths |
| `vashira-extension/` | Browser extension "Vashira Snatcher-X" (MV3) | Vanilla JS, posts captures to `localhost:51235` |
| `vashira-word-addin/` | Microsoft Word task-pane add-in ("Vashira Scribe") for inserting citations | Office.js taskpane, static HTML |
| `vashira-org/` | Marketing/landing page (deployed via Netlify) | Static HTML |
| `index.html` (repo root) | A second landing page, deployed separately from `vashira-org/` | Static HTML |

`vashira-app/sentinel/` is a **second**, more advanced copy of the browser extension (also MV3, name "Vashira Sentinel") bundled inside the Electron app's source tree, distinct from the top-level `vashira-extension/`. `vashira-app/office/` is a **second** Word/Excel add-in manifest, distinct from the top-level `vashira-word-addin/`. When asked to change "the extension" or "the Word add-in," confirm which of the two copies is meant — they are not kept in sync automatically.

Almost all active development happens in `vashira-app/`. `vashira-app/CHANGELOG.md` is actively maintained — check it for the most recent per-release summary before assuming something is unimplemented.

## Commands

All commands below run from `vashira-app/` unless noted.

```bash
npm install              # install deps (.npmrc sets legacy-peer-deps: the unused vite toolchain has a peer conflict)
npm start                 # build then launch the Electron app (electron-forge start)
npm run build              # build:main + build:preload + build:renderer (esbuild + a custom script)
npm run lint                # eslint --ext .ts,.tsx .
npm run package              # build + electron-forge package → portable app dir in out/Vashira-<platform>-x64/
npm run install:local        # Windows: package, copy to %LOCALAPPDATA%\Programs\Vashira, Start menu + desktop shortcuts
```

There is **no test suite** in this repository (no test runner is configured, no `*.test.*`/`*.spec.*` files exist). To sanity-check logic that touches `better-sqlite3` without opening a window, see "Headless verification" below. `npx tsc --noEmit` is broken independently of any change (TypeScript is pinned at 4.5, too old for the tsconfig and current `@types/node`) — `npm run build` (esbuild, no type-check) is the build check.

Toolchain: Electron 44 (Node 24 inside), Forge 7.11, Node ≥ 22.12 to install. `better-sqlite3` ≥ 13 ships Node-API prebuilds for every OS (`prebuilds/<platform>-<arch>.node`), so `forge.config.ts` sets `rebuildConfig.ignoreModules: ['better-sqlite3']` — don't let Forge recompile it.

**Distribution** (plan and status in `ROADMAP.md` at the repo root): `.github/workflows/release.yml` builds Windows (portable zip via `npm run package`), Linux (`.deb` + AppImage via `electron-forge make`) and macOS (Apple Silicon `.app` zipped with `ditto`, unsigned — the fuses plugin re-applies the ad-hoc signature) on every `v*` tag and publishes one GitHub Release; a manual `workflow_dispatch` run builds without publishing. The Squirrel installer (`npm run make` on Windows) is deliberately unused — unsigned, and its zip maker fails on modern Node. Warning-free Windows installs are planned via the Microsoft Store (MSIX, `@electron-forge/maker-msix`, `sign: false`); don't propose paid code signing.

Build pipeline detail: `npm run build` does NOT use electron-forge's Vite plugin despite `forge.config.ts` importing `VitePlugin` (it's imported but never added to the `plugins` array — dead import). The real build is three esbuild invocations wired directly in `package.json`:
- `build:main` — esbuild-bundles `src/main.ts` **and** `src/pdf-worker.ts` → `.vite/build/{main,pdf-worker}.js` (externals: `electron`, `better-sqlite3`, `pdfjs-dist` — pdf.js is ESM-only and loaded at runtime with dynamic `import()`; don't add a static import of it to any main-process module)
- `build:preload` — esbuild-bundles `src/preload.ts` → `.vite/build/preload.js`
- `build:renderer` — runs `build-renderer.mjs`, which esbuild-bundles `src/renderer.tsx` → `.vite/renderer/main_window/assets/index.js` and rewrites `index.html` to point at it

`build-script.mjs` (Vite-based, builds main/preload/renderer via `vite.build()`) exists in the same directory but is **not** referenced by any npm script — treat it as unused/legacy unless you're specifically asked to revive it.

### Headless verification

Run DB-touching scripts with Electron's Node, not the system Node, so the runtime matches what ships. To exercise `database.ts` (or anything importing it) without opening a window: esbuild-bundle the target file to a `.mjs`/`.cjs` inside `vashira-app/` (so `node_modules` resolution works), set `VASHIRA_HUB_PATH` to a scratch dir, and run it with `node_modules/electron/dist/electron.exe <script>` instead of plain `node` — Electron's bundled Node has the matching ABI and runs headless under `ELECTRON_RUN_AS_NODE=1` without opening a GUI.

### vashira-node (headless server)
```bash
npm run dev     # ts-node src/index.ts
npm run build    # esbuild → dist/index.js
npm start         # node dist/index.js
```
It imports `initDatabase`/`getItems` from `../../vashira-app/src/database` and `discoveryEngine` from `../../vashira-app/src/discovery` directly — it is not a standalone package and will break if those files move or change their exports. `database.ts` detects Electron's absence and falls back to `process.env.VASHIRA_HUB_PATH || process.cwd()` for the SQLite file location, which is what makes this dual-use possible.

### Browser extensions / Word add-ins
No build step — load `vashira-extension/` or `vashira-app/sentinel/` as an unpacked MV3 extension; the Word add-ins are served as static files per their manifest's `SourceLocation`.

## Architecture (vashira-app)

**Process model** is standard Electron two-world:
- `src/main.ts` — the entire main process. It initializes the DB, wires ~50 `ipcMain.handle`/`ipcMain.on` channels, and also stands up **three plain `http.createServer` instances on fixed localhost ports** that exist alongside IPC as an alternate integration surface:
  - `:51235` — "Snatcher" ingest server. Accepts POSTs from the browser extensions and Word/Office add-ins (`/`, `/ingest`, `/api/v1/format-bibliography`) and GETs for a small read API (`/items`, `/api/v1/items`, `/api/v1/collections`, `/api/v1/tags`, `/mobile`).
  - `:51236` — "AI Provider" — stub OpenAI-compatible (`/v1/chat/completions`) and MCP (`/mcp`) endpoints.
  - `:51239` — second ingest server (`/ingest`) used by the Sentinel extension flow.

  All three bind to `127.0.0.1` only (`:51235` used to be `0.0.0.0`, which exposed the whole library to the LAN; every extension/add-in client uses `localhost`/`127.0.0.1`). They're still unauthenticated listeners that accept arbitrary JSON and can write files, so be deliberate about what you expose there — and don't bind anything to a non-loopback interface without an explicit opt-in and pairing.
- `src/preload.ts` — the only bridge to the renderer, via `contextBridge.exposeInMainWorld('vashiraAPI', {...})`. Every method the renderer calls must exist here with the exact same name as an `ipcMain.handle`/`.on` channel in `main.ts` — this project has a history of renderer/bridge drift (calls to methods that were never exposed), so when adding a new feature, wire all three of component → `preload.ts` → `main.ts` together rather than assuming a channel that exists on one side exists on the other.
- `src/App.tsx` + `src/components/*.tsx` — the renderer (React, all state in `App.tsx`, no state library). Components: `Sidebar`, `TopBar`, `LibraryGrid`, `KnowledgeHub` (item detail panel), `OracleUI`, `SettingsUI`, `Scribe`, `SharedVault`, `Tour` (first-run onboarding), `SharingPrompt` (LAN-sharing opt-in), `DuplicatesView`, `DiscoverView`, `RelatedPanel`, `PaperCard`.

**Data layer** (`src/database.ts`): a single `better-sqlite3` connection, schema modeled loosely on Zotero (`items`, `creators`, `collections`, `tags`, `item_tags`, `annotations`, `notes`, `search_index`, `consensus_registry`, `sync_log`). Migrations are not files — `initDatabase()` runs `CREATE TABLE IF NOT EXISTS` for the full schema, then a "Schema Guard" block diffs `PRAGMA table_info(items)` against a hardcoded `requiredColumns` list and runs `ALTER TABLE ... ADD COLUMN` for anything missing (same guard pattern was used to migrate `consensus_registry` onto a per-voter primary key — see below). If you add a column to `items`, add it to both the `CREATE TABLE` and the `requiredColumns` array or existing user DBs won't pick it up. `resolveDbPath()`/`getStoragePath()` both branch on whether `electron`'s `app` is ready, which is what lets `vashira-node` reuse this file headless. Items are soft-deleted (`deletedAt`): every listing query must filter `deletedAt IS NULL`; `purgeTrashedItems` removes all dependent rows and returns file paths, and `main.ts` deletes only files inside `vashira_storage` that no other item references. Imported PDFs live at `vashira_storage/<itemId>/<filename>` (older imports are flat in `vashira_storage/`). `fileHash` = SHA-256 of the **first 20 KB** and doubles as the P2P identifier — never change how it's computed. There is no fake/seeded "welcome" item any more — a fresh install starts with zero items; first-run guidance is the guided tour, not placeholder data.

**P2P discovery & consensus** (`src/discovery.ts`): a UDP-broadcast (`dgram`, port 41234) peer protocol — `HEARTBEAT`, `MASTERY_ANNOUNCE` (lightweight "someone added item X" gossip, title only), `REQUEST_METADATA`/`RESPONSE_METADATA` (full metadata exchange between two specific peers). `src/relay-service.ts` (`CommunityRelay`) extends this to WAN by checking in with `https://peers.vashira.io/v1` to exchange public IPs, and `src/nat-service.ts` does UPnP port mapping so WAN peers can reach this node. All three are singletons/classes instantiated in `main.ts`'s `ready` handler.

LAN sharing is **opt-in** in the desktop app: `discoveryEngine.setSharingEnabled()` gates both `announceMetadata` and answering `REQUEST_METADATA`; `main.ts` sets it from the `shareOnLan` setting (asked once via a choice step in the Tour, or `SharingPrompt` for users who never saw it; toggle in Settings). `vashira-node` keeps the default (enabled). `sendMetadata` only ever sends `SHAREABLE_FIELDS` (bibliographic fields + `fileHash`) — never paths, URLs, notes or personal fields.

Settings the main process must act on, and API keys, live in `src/settings.ts` (`<userData>/settings.json`; keys encrypted with Electron `safeStorage`), reached via `get-setting`/`set-setting`/`get-secret`/`set-secret` — not `localStorage`.

Metadata trust is deliberately two-tiered — don't conflate them: **DOI'd items always defer to CrossRef** (already authoritative; there's a "Verify via CrossRef" action in `KnowledgeHub`, not a peer vote). **Peer consensus** (`consensus_registry` / `upsertConsensus`/`getConsensus` in `database.ts`) only applies to items identified by file hash (books/scans where local heuristics guessed). Votes are keyed by `(identifier, title, authors, published, voterId)` — `voterId` is the responding peer's IP, recorded so a candidate's strength reflects **distinct peers**, not exchanges answered; `getConsensus` only surfaces a candidate once `COUNT(DISTINCT voterId) >= 2`. A `MASTERY_ANNOUNCE` never writes a vote (it carries no real metadata, only a title) — only a real `RESPONSE_METADATA` exchange does.

**Metadata acquisition** is split across three layers with distinct responsibilities:
- `src/gatherer.ts` — DOI/ISBN extraction regexes + CrossRef DOI lookup.
- `src/translator-service.ts` — a `Translator` registry (ArXiv, CrossRef, OpenLibrary, priority-ordered) plus dynamic plugin loading from a `plugins/` folder next to app storage (`<userData>/plugins/*.js`) — this is the "Sovereign Extensions" mechanism mentioned in the README/CHANGELOG.
- `src/parser.ts` — offline parsing of already-acquired data: BibTeX/RIS parsing (both persist directly to the DB from their `ipcMain` handlers), BibTeX export (`generateBibTeX`), heuristic metadata extraction from raw PDF text, and keyword-based "Magic Categorization."

Smaller main-process modules, all imported by `main.ts`: `oracle.ts` (`askTheOracle` — RAG context assembly + LLM call for the Oracle tab), `archiver.ts` (`captureSnapshot` — renders a URL to PDF in a hidden `BrowserWindow`), `scrapper.ts` (`scrapeDocx` — pulls citation keys out of `.docx` files via `mammoth`/`adm-zip`), `zotero-service.ts` (Zotero Web API v3 import, metadata only). `discovery_api.ts` (OpenAlex search) has no static import — it's loaded lazily via `require('./discovery_api')` inside the `search-global` handler and exposed as `vashiraAPI.searchGlobal`, but no component calls it yet.

**PDF identification** (`src/pdf-metadata.ts` → `identifyPdf`): DOI/ISBN from the first pages' real text (pdf.js) → online lookup; else the PDF info Title/Author (rejected when they look like typesetting file names), the file name ("Author - Title", "Author_Year_Title"), then page-1 text. `looksLikeJunkTitle` + `repairJunkMetadata` in `main.ts` re-identify items imported with raw-byte titles. Don't parse raw PDF bytes for metadata.

**Discovery** (`src/openalex.ts`): OpenAlex lookups straight from the user's machine (no Vashira server) — `relatedForItem` (DOI → work, else exact-title search; references / cited-by / related), `searchWorks`, `librarySuggestions` (works cited by ≥ 2 library papers). Responses cached in `openalex_cache` for 14 days; optional key in secrets (`openalex`); limit errors surface as `OpenAlexLimitError`. IPC returns `{ error }` instead of throwing. `downloadOaPdf` in `main.ts` keeps only bodies starting with `%PDF-`. UI: `DiscoverView`, `RelatedPanel` (detail panel), shared `PaperCard`.

**Duplicates** (`src/duplicates.ts`): exact (DOI / ISBN-13 / fileHash) and likely (title trigram Dice ≥ 0.9 + same year or first author) groups; `mergeItems` moves tags/collections/notes/annotations/relations to the master, trashes the rest, and logs a `MERGE` snapshot in `sync_log` for `undoMerge`. Every import path checks `findExactDuplicatesFor` first.

**Collections & Tags**: relational, Zotero-style — `collections`/`collection_items` and `tags`/`item_tags` junction tables. Sidebar lists both and filtering re-queries the DB directly (`getItemsByCollection`/`getItemsByTag`) rather than filtering the flat `items` array client-side, since collection/tag membership isn't part of an item's own row.

**Full-text indexing/search** (`src/indexer.ts`, `src/pdf-text.ts`, `src/pdf-worker.ts`): per-page text extracted with pdf.js inside an Electron `utilityProcess` (in-process fallback when headless or if the worker crashes) and stored in the FTS5 table `page_text(text, itemId, page)` with `remove_diacritics` tokenizing. `searchFullText` (ranked `bm25`, snippets marked `«…»`) feeds the library search box; `searchDeep` returns items with their best pages' text as `content` for the Oracle. A flat copy still goes to `search_index.fullText` for compatibility. `items.textIndexVersion` vs `TEXT_INDEX_VERSION` drives a background re-index on launch — bump it when extraction changes. The old raw-bytes "strings" extractor captured PDF syntax, not text; don't bring it back. OCR (`ocr-service.ts`) is a placeholder: `scanPdf` returns a fixed string, so `run-mastery-scan` refuses rather than indexing it.

**Citations** (`src/citation.ts`): wraps `citeproc` (CSL). Offline styles: `MINIMAL_APA/IEEE/MLA_STYLE` (literal XML) plus the official EHESS "Le tapuscrit" note and author-date styles, and the official en-US/fr-FR/es-ES CSL locales — the latter as verbatim files in `src/styles/` (CC BY-SA, keep them unmodified), bundled as text via esbuild's `--loader:.csl=text --loader:.xml=text` (`style-assets.d.ts` types them). `BUILTIN_STYLES` in `main.ts` maps Settings ids to them. `toCSL` maps item types, year from `published`, journal/publisher/volume/issue/pages/ISBN; `parseAuthors` handles the several author-string shapes importers produce. `generate-citation-rich` returns `{text, html}` for the clipboard. Any other style name falls through to `src/styles.ts` (`StyleStore`), which fetches/caches real CSL style XML from the Zotero style repo on demand — that path needs network access and isn't exercised by the UI today.

**First-run onboarding** (`src/components/Tour.tsx`): a spotlight tour driven by a `data-tour="<name>"` attribute convention — components mark real, working controls with this attribute, and `Tour`'s step list references those names plus an optional `tab` (it calls back into `App.tsx` to switch tabs as it progresses) and `choice` (a question step answered with buttons instead of NEXT), and `requiresItem` (auto-selects the first library item to demo the detail panel if one exists, otherwise that step degrades to a centered description rather than pointing at nothing). When adding a new top-level control, consider whether it belongs in the tour, and keep the `data-tour` name and the `STEPS` entry in sync — nothing checks that at build time.

## Cross-cutting notes

- Every sub-project's package.json/manifest independently declares "Vashira" branding and version numbers that are **not** kept in lockstep (e.g. `vashira-app` is at `10.3.0`, `vashira-node` at `4.0.0`, extensions at `1.0`). Don't assume a version bump in one implies anything about the others.
- Ports `51235`, `51236`, `51239` (vashira-app) and `41234` (P2P UDP) are load-bearing integration points referenced from other sub-projects (extensions, Office add-ins) via hardcoded URLs — grep for the port number across sub-projects before changing one.
- Copy throughout the codebase (variable names, log messages, UI strings) uses the app's own vocabulary — "Mastery" for indexing/import actions, "Sovereign"/"Hub" for the local-first architecture, "Snatcher"/"Sentinel" for capture — this is intentional branding, not a naming inconsistency to "fix."
- The P2P layer is scoped to metadata only, by design — titles, authors, DOIs, hashes, consensus votes, never file bytes. Don't build or suggest peer-to-peer file transfer for this project.
