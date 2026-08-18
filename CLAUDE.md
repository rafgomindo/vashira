# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

Vashira is a decentralized, AI-augmented reference manager (a Zotero alternative). This is a monorepo containing five independently-versioned sub-projects that share no build tooling but overlap in code/protocol:

| Directory | What it is | Tech |
|---|---|---|
| `vashira-app/` | The main product: an Electron desktop app | Electron + React (TSX) + better-sqlite3 |
| `vashira-node/` | Headless "Sovereign Hub" server for NAS/community deployments | Express, imports `vashira-app/src` directly via relative paths |
| `vashira-extension/` | Browser extension "Vashira Snatcher-X" (MV3) | Vanilla JS, posts captures to `localhost:51235` |
| `vashira-word-addin/` | Microsoft Word task-pane add-in ("Vashira Scribe") for inserting citations | Office.js taskpane, static HTML |
| `vashira-org/` | Marketing/landing page (deployed via Netlify) | Static HTML |
| `index.html` (repo root) | A second landing page, deployed separately from `vashira-org/` | Static HTML |

`vashira-app/sentinel/` is a **second**, more advanced copy of the browser extension (also MV3, name "Vashira Sentinel") bundled inside the Electron app's source tree, distinct from the top-level `vashira-extension/`. `vashira-app/office/` is a **second** Word/Excel add-in manifest, distinct from the top-level `vashira-word-addin/`. When asked to change "the extension" or "the Word add-in," confirm which of the two copies is meant — they are not kept in sync automatically.

Almost all active development happens in `vashira-app/`.

## Commands

All commands below run from `vashira-app/` unless noted.

```bash
npm install              # install deps (better-sqlite3 needs a Python toolchain to build natively)
npm start                 # build then launch the Electron app (electron-forge start)
npm run build              # build:main + build:preload + build:renderer (esbuild + a custom script)
npm run lint                # eslint --ext .ts,.tsx .
npm run package              # build + electron-forge package (portable dir, no installer)
npm run make                   # build + electron-forge make (produces installers: squirrel/.exe, zip, deb, rpm)
```

There is **no test suite** in this repository (no test runner is configured, no `*.test.*`/`*.spec.*` files exist).

Build pipeline detail: `npm run build` does NOT use electron-forge's Vite plugin despite `forge.config.ts` importing `VitePlugin` (it's imported but never added to the `plugins` array — dead import). The real build is three esbuild invocations wired directly in `package.json`:
- `build:main` — esbuild-bundles `src/main.ts` → `.vite/build/main.js` (externals: `electron`, `better-sqlite3`)
- `build:preload` — esbuild-bundles `src/preload.ts` → `.vite/build/preload.js`
- `build:renderer` — runs `build-renderer.mjs`, which esbuild-bundles `src/renderer.tsx` → `.vite/renderer/main_window/assets/index.js` and rewrites `index.html` to point at it

`build-script.mjs` (Vite-based, builds main/preload/renderer via `vite.build()`) exists in the same directory but is **not** referenced by any npm script — treat it as unused/legacy unless you're specifically asked to revive it.

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
- `src/main.ts` — the entire main process. It initializes the DB, wires ~40 `ipcMain.handle`/`ipcMain.on` channels, and also stands up **three plain `http.createServer` instances on fixed localhost ports** that exist alongside IPC as an alternate integration surface:
  - `:51235` — "Snatcher" ingest server. Accepts POSTs from the browser extensions and Word/Office add-ins (`/`, `/ingest`, `/api/v1/format-bibliography`) and GETs for a small read API (`/items`, `/api/v1/items`, `/api/v1/collections`, `/api/v1/tags`, `/mobile`).
  - `:51236` — "AI Provider" — stub OpenAI-compatible (`/v1/chat/completions`) and MCP (`/mcp`) endpoints.
  - `:51239` — second ingest server (`/ingest`) used by the Sentinel extension flow.
  
  Because these are unauthenticated `0.0.0.0`/`127.0.0.1` HTTP listeners that accept arbitrary JSON and can write files, be deliberate about what you expose there — this is the trust boundary for the whole app.
- `src/preload.ts` — the only bridge to the renderer, via `contextBridge.exposeInMainWorld('vashiraAPI', {...})`.
- `src/App.tsx` + `src/components/*.tsx` — the renderer (React, all state in `App.tsx`, no state library).

**Known drift — `window.vashiraAPI` in `App.tsx` does not match what `preload.ts` exposes.** `App.tsx` calls `vashiraAPI.getLibrary()`, `vashiraAPI.onP2PStatus()`, `vashiraAPI.checkDuplicates()`, `vashiraAPI.importFile()`, and `vashiraAPI.askOracle()`, none of which `preload.ts` defines (it exposes `getItems`, `importPDF`, `check-duplicates` isn't even exposed at all, etc.). `src/oracle.ts` (`askTheOracle`) is fully implemented but never imported by `main.ts` or `preload.ts`, so the Oracle/RAG feature is inert in the current renderer. Before assuming a feature works end-to-end, trace the call from the component through `preload.ts` to an `ipcMain.handle` in `main.ts` — don't assume the wiring is complete just because all three files exist.

**Known bug pattern — escaped template interpolations.** Many template literals across the codebase use `` \${x} `` (escaped `$`) instead of `` ${x} ``, which makes JS treat it as literal text `${x}` rather than interpolating the value. This is not a one-off typo; it recurs in `oracle.ts`, `translator-service.ts`, `indexer.ts`, `nat-service.ts`, `archiver.ts`, `App.tsx`, `LibraryGrid.tsx`, `Scribe.tsx`, `SettingsUI.tsx` and elsewhere — including at least one case where it silently breaks a CSS class name (`` `toast glass \${toast.type}` `` in `App.tsx`). When editing near a template literal, check whether nearby ones are already broken this way rather than assuming they're intentional.

**Data layer** (`src/database.ts`): a single `better-sqlite3` connection, schema modeled loosely on Zotero (`items`, `creators`, `collections`, `tags`, `annotations`, `notes`, `search_index`, `consensus_registry`, `sync_log`). Migrations are not files — `initDatabase()` runs `CREATE TABLE IF NOT EXISTS` for the full schema, then a "Schema Guard" block diffs `PRAGMA table_info(items)` against a hardcoded `requiredColumns` list and runs `ALTER TABLE ... ADD COLUMN` for anything missing. If you add a column to `items`, add it to both the `CREATE TABLE` and the `requiredColumns` array or existing user DBs won't pick it up. `resolveDbPath()`/`getStoragePath()` both branch on whether `electron`'s `app` is ready, which is what lets `vashira-node` reuse this file headless.

**P2P discovery** (`src/discovery.ts`): a UDP-broadcast (`dgram`, port 41234) peer protocol — `HEARTBEAT`, `MASTERY_ANNOUNCE`, `REQUEST_METADATA`/`RESPONSE_METADATA` — used for LAN peer discovery and metadata gossip/consensus. `src/relay-service.ts` (`CommunityRelay`) extends this to WAN by checking in with `https://peers.vashira.io/v1` to exchange public IPs, and `src/nat-service.ts` does UPnP port mapping so WAN peers can reach this node. All three are singletons/classes instantiated in `main.ts`'s `ready` handler.

**Metadata acquisition** is split across three layers with distinct responsibilities — don't conflate them:
- `src/gatherer.ts` — DOI/ISBN extraction regexes + CrossRef DOI lookup.
- `src/translator-service.ts` — a `Translator` registry (ArXiv, CrossRef, OpenLibrary, priority-ordered) plus dynamic plugin loading from a `plugins/` folder next to app storage (`<userData>/plugins/*.js`) — this is the "Sovereign Extensions" mechanism mentioned in the README/CHANGELOG.
- `src/parser.ts` — offline parsing of already-acquired data: BibTeX/RIS import-export, heuristic metadata extraction from raw PDF text, and keyword-based "Magic Categorization."

**Full-text indexing/search** (`src/indexer.ts`): does NOT use `pdf-parse`/`pdfjs-dist` for the default path — it runs a hand-rolled "strings"-style regex extractor over the raw PDF bytes (`extractSovereignText`) for speed, and only falls back to OCR (`src/ocr-service.ts`, `tesseract.js`) when the extracted text is short and `ocrService.isSilentPdf()` confirms it's an image-only/scanned PDF. Indexed text lands in the `search_index` FTS-less table (`LIKE`-based search via `searchDeep`), not the `items` table.

**Citations**: `src/citation.ts` wraps `citeproc` (CSL) with a bundled `MINIMAL_APA_STYLE` fallback; `src/styles.ts` (`StyleStore`) fetches/caches real CSL style XML from the Zotero style repo on demand.

**Consensus/community**: when peers gossip metadata for the same DOI/hash, `upsertConsensus`/`getConsensus` in `database.ts` track vote counts in `consensus_registry`, surfaced to let a user pick among conflicting metadata submitted by different peers rather than the app silently trusting one source.

## Cross-cutting notes

- Every sub-project's package.json/manifest independently declares "Vashira" branding and version numbers that are **not** kept in lockstep (e.g. `vashira-app` is at `10.0.0`, `vashira-node` at `4.0.0`, extensions at `1.0`). Don't assume a version bump in one implies anything about the others.
- Ports `51235`, `51236`, `51239` (vashira-app) and `41234` (P2P UDP) are load-bearing integration points referenced from other sub-projects (extensions, Office add-ins) via hardcoded URLs — grep for the port number across sub-projects before changing one.
- Copy throughout the codebase (variable names, log messages, UI strings) uses the app's own vocabulary — "Mastery" for indexing/import actions, "Sovereign"/"Hub" for the local-first architecture, "Snatcher"/"Sentinel" for capture — this is intentional branding, not a naming inconsistency to "fix."
