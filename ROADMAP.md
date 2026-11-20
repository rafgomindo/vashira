# Vashira Roadmap

_Drafted 2026-11-20 · Current version: 10.2.0 (not released yet)_

## Status

| Item | State |
|---|---|
| Phase 0 — Foundations | **Built & pushed** (v10.2.0, not yet tagged); headless checks pass; waiting on your `npm start` test |
| D1 — Linux & Mac CI | **Working**: the manual test build produces the Windows zip, Linux .deb + AppImage and macOS arm64 zip (not launch-tested on Linux/Mac) |
| D2 — Privacy page + download links | **Live** at https://vashira.org/privacy.html |
| D3 — Microsoft Store | Waiting on your Partner Center account + identity values |
| Phase 1 — Duplicates | **Built**, committed locally (not pushed); 24 headless checks pass; needs your UI test |
| Phases 2–4 | Not started |

Deviation from the plan: the `/mobile` "bridge" was only a placeholder page, so instead of building LAN pairing for it, the `:51235` server is simply loopback-only. Pairing can come back if a real mobile feature is ever built.

This plan covers two goals:
- Make Vashira installable without the Windows warning.
- Add four features that take it past Zotero: duplicate merging, related-paper discovery, a built-in PDF reader, and free offline AI.

The first half is for making decisions. The phase sections further down are the implementation spec.

## At a glance

| # | Phase | What users get | Size | Ships in |
|---|---|---|---|---|
| 0 | Foundations | Search that actually reads PDF text, a Trash, privacy fixes, Linux & Mac downloads | M | v10.2 |
| 1 | Duplicates | Find and merge duplicates; a warning when importing something you already have | S | v10.3 |
| 2 | Discovery | References, "cited by" and similar papers for any item; papers your library keeps citing; free legal PDFs | M | v10.3 |
| 3 | PDF reader | Read, highlight and annotate PDFs inside Vashira | L | v11.0 |
| 4 | Local AI | Smart search, summaries, Q&A with page citations, tag suggestions. Offline, no API key | L | v11.1 |
| D | Microsoft Store | One-click install, no warning, automatic updates | M | once v10.2 ships and the Store account exists |

Sizes are relative (S < M < L). Every phase ends with a build to test on the real PC, since Claude's sandbox can't open the app window.

**Total cost: $0.** The only paid option anywhere is Apple's $99/year developer program, and it's optional (D4).

**Why this order:**
- Phase 0 fixes things the other phases depend on:
  - The AI is only as good as the text it reads.
  - Merging needs a Trash.
  - The Store needs the privacy fixes.
- Phases 1–2 are quick, visible wins.
- The reader is the biggest piece and needs a design pick first.
- AI comes last because its answers link to the exact page in the reader, and it uses Phase 0's text index.

## What only you can do

- [ ] **Register a Microsoft Store developer account.** It's free for individuals since Sept 2025.
  - Start at https://storedeveloper.microsoft.com. Other entry points can still show the old paid flow.
  - Verify your identity with a government ID and a selfie.
  - Reserve the name "Vashira".
  - From Partner Center → Product identity, send me three values: `Package/Identity/Name`, `Package/Identity/Publisher` (starts with `CN=`) and `Package/Properties/PublisherDisplayName`.
- [ ] **Test each release** with `npm start`, using the checklist at the end of each phase.
- [ ] **Pick a reader design** from the 2–3 concepts shown before Phase 3 starts.
- [ ] **Upload each Store release** in Partner Center. CI builds the file and the upload takes a few minutes; it can be automated later.
- [ ] **Answer the decisions below.**

Claude asks before pushing any tag, publishing a release or submitting anything.

## Decisions (made 2026-11-20)

1. **Microsoft Store: yes.** The account is being registered (free individual account).
2. **Network sharing: ask once during the first-run tour.** Sharing stays off until the user says yes. (Today every PDF import is broadcast on the local network automatically.)
3. **Mac: unsigned Apple Silicon build** with "Open Anyway" instructions. No paid Apple program.

## Compared with Zotero

| | Built into Zotero 7 | Vashira today | After this roadmap |
|---|---|---|---|
| PDF reader with highlights & notes | Yes | No | Yes (Phase 3) |
| Find & merge duplicates | Yes | Warning only | Yes (Phase 1) |
| References / cited-by / similar papers | No (plugins) | No | Yes (Phase 2) |
| "Papers your library keeps citing" | No | No | Yes (Phase 2) |
| AI summaries & Q&A over your library | No (plugins + API keys) | API key only | Built in, offline, free (Phase 4) |
| Peer-verified metadata | No | Yes | Yes |

---

## Phase 0 — Foundations (v10.2)

**Why first: the indexer doesn't read PDF text today.** This was tested on the 5 PDFs in the local library:
- For all five, the current extractor (`extractSovereignText`) stored PDF file syntax (`PDF-1.6 1 0 obj Metadata 2 0 R …`) instead of the papers' text.
- pdf.js recovered the real text from all five, in English, French and Spanish.

Deep Search and the Oracle have been working from that junk.

**0.1 Upgrade Electron 32 → current stable (first, since the rest builds on it)**
- **Security:** Electron 32 stopped getting security fixes in early 2025, and Vashira renders arbitrary web pages (the `archiver.ts` snapshots).
- **Compatibility:** Electron 32 ships Node 20.18. The installed `pdfjs-dist` 5.6 already declares Node ≥ 20.19, `pdfjs-dist` 6 needs ≥ 22.13, and node-llama-cpp (Phase 4) expects a modern Node too.
- **Steps:**
  - Bump Electron and let Forge rebuild `better-sqlite3`.
  - Raise the CI Node version from 20 to 22, because the Electron npm package needs Node ≥ 22.12.
  - Rerun the headless DB checks, then the user smoke-tests.
- Stay on Forge 7.11: the MSIX maker (D3) exists for 7.11.

**0.2 Real full-text index**
- **Extraction:** replace `extractSovereignText` (`src/indexer.ts`) with pdf.js text extraction (`pdfjs-dist/legacy/build/pdf.mjs`, already a dependency). Run it in a `worker_threads` worker so 300-page books don't freeze the app.
- **Storage:** keep text per page in a new FTS5 table (verified: FTS5 works in the bundled SQLite), e.g. `CREATE VIRTUAL TABLE page_text USING fts5(text, itemId UNINDEXED, page UNINDEXED)`.
- **Search:** rewrite `searchDeep` to rank with `bm25()` and return page numbers and snippets. Keep writing `search_index` until nothing reads it.
- **Existing library:** run a one-time background re-index with a progress toast.
- **OCR:** the trigger stays the same (very little text and `isSilentPdf`). But `ocrService.scanPdf` is a placeholder that returns a fixed string, and `run-mastery-scan` writes that string into the index. Keep it unwired (no component calls it today) until real OCR exists.

**0.3 Trash**
- Add a `deletedAt` column on `items`, in both CREATE TABLE and `requiredColumns`. Every list query excludes trashed items.
- Add a Trash entry to the sidebar, with Restore and Empty Trash. The `'trash'` branch of `getItemsByCategory` is currently a stub.
- Empty Trash deletes the item's rows in:
  - `item_tags`, `collection_items`, `notes`, `annotations`, `item_relations`
  - the full-text tables
  - its stored file, but only if that file is inside `vashira_storage`.

**0.4 Attachment storage**
- `import-pdf` copies every file to `vashira_storage/<filename>`, so two PDFs with the same name overwrite each other. Store new imports as `vashira_storage/<itemId>/<filename>`; existing files stay where they are.
- **Don't change** how `fileHash` is computed (SHA-256 of the first 20 KB). It's the P2P identifier, and changing it would stop matching with peers on older versions.

**0.5 Privacy & network fixes.** The Store's privacy policy needs these, and so does the landing page's "GDPR-Native Privacy" claim.
- **Capture server:** bind `:51235` to `127.0.0.1` instead of `0.0.0.0`.
  - Today `GET /items` hands the whole library, local file paths included, to anyone on the same network.
  - All extension and add-in clients already use `localhost`/`127.0.0.1` (verified), so nothing breaks.
  - The `/mobile` bridge becomes an opt-in setting with a pairing code.
- **Peer replies:** `discoveryEngine.sendMetadata` sends the entire DB row, including `filePath`, which contains the Windows username. Send a whitelist of bibliographic fields only.
- **Sharing setting:** add the network-sharing setting from decision 2, and make `announceMetadata` respect it.
- **API keys:** move the Oracle and Zotero keys out of plaintext `localStorage`, into main-process storage encrypted with Electron `safeStorage`.

**0.6 Ships alongside:** D1 (Linux & Mac builds) and D2 (privacy page).

**Done when:**
- A headless script indexes sample PDFs, and an FTS search returns the right page.
- Trash, restore and empty-trash leave no orphan rows.
- `:51235` listens on 127.0.0.1 only.
- CI produces Windows, Linux and Mac builds.

**Your test:**
- Import a PDF, search a phrase from page 5, and confirm it's found with "p. 5".
- Delete an item, then restore it from Trash.

## Phase 1 — Duplicates (v10.3)

**Detection:** one `findDuplicates` function in `database.ts`, used everywhere.
- **Exact matches:**
  - same DOI (lower-cased, with `https://doi.org/` stripped)
  - same ISBN (normalized to ISBN-13)
  - same `fileHash`
- **Likely matches:** title similarity ≥ 0.9 (normalized titles, trigram/Dice) **and** either the same year or the same first-author surname.

**Duplicates view** in the sidebar:
- Shows groups of duplicates.
- "Merge all exact matches" in one click.
- Likely matches are reviewed one by one.

**Merge screen:**
- The two records side by side. Pick a master, and choose per field where they differ (title, authors, year, abstract…).
- Choose which PDF to keep.
- Tags, collections, notes, annotations and relations are combined onto the master. The other record goes to Trash.

**Undo:** each merge writes a `MERGE` entry with the losing record's full snapshot to `sync_log`, which already exists. "Undo merge" restores from it.

**On import** (PDF, BibTeX/RIS, Zotero sync, browser capture): if an exact duplicate exists, show "Already in your library — open it / add anyway" instead of silently adding a copy. This replaces the title-only `check-duplicates`.

**Also:** a Tour step for the Duplicates view.

**Done when:** a headless test merges two seeded items, checks that every junction-table row moved, and checks that undo restores the original.

**Your test:**
- Import the same PDF twice and confirm you get the warning.
- Merge two items and confirm the master has the tags from both.

## Phase 2 — Related-paper discovery (v10.3)

**Data source: OpenAlex**, called directly from each user's computer. There's no Vashira server and no key needed.

Limits (checked Nov 2026): OpenAlex moved to a daily budget in 2026.

| Request type | Cost |
|---|---|
| Single-record lookup | Free |
| List call | $0.0001 |
| Search | $0.001 |

- **Without a key:** about $0.10/day per IP, so roughly 1,000 list calls or 100 searches per user per day.
- **With a free key:** 10× that. Add an optional OpenAlex key field in Settings.
- **Caching:** store responses in SQLite (`openalex_cache`, ~14-day expiry), so revisiting an item costs nothing.
- **Fallback:** OpenAlex already changed its limits once this year. If it tightens again, fall back to Semantic Scholar or Crossref.

**Related panel** in the item detail panel, with three tabs:
- *References*: what this paper cites (`referenced_works`).
- *Cited by*: newer papers that cite it (`filter=cites:W…`, most-cited first).
- *Similar*: OpenAlex's `related_works`.

Each result shows title, authors, year, venue and citation count, an "In your library" badge (matched by DOI), and **+ Add**.

**"Your library keeps citing":** count which works are referenced most across the user's items, and list the top ones they don't own yet. It's cheap: one free lookup per item, plus batched list calls.

**Discover tab:** keyword search across OpenAlex. Rewrite `discovery_api.ts`:
- It passes parameters OpenAlex doesn't recognize (`limit`, `sort: 'relevance'`).
- It throws away the abstract.
- Nothing in the UI calls it yet (`vashiraAPI.searchGlobal`).

**Items without a DOI:** "Find in OpenAlex" matches them by title and year, so they get the Related panel too.

**Free legal PDFs:** when OpenAlex lists an open-access copy (`best_oa_location.pdf_url`), offer "Get free PDF". It downloads directly from the publisher or repository, never through peers.

**Added items** are built from OpenAlex metadata (the abstract is rebuilt from `abstract_inverted_index`) and go through Phase 1's duplicate check.

**Done when:**
- For a known DOI, all three tabs return results, and a second view is served from cache.
- Running out of budget shows "Discovery limit reached for today — add a free OpenAlex key in Settings".

**Your test:** open an item with a DOI, add a paper from its "Cited by" tab, and confirm it appears in the Library.

## Phase 3 — Built-in PDF reader (v11.0)

**Step 0 — design concepts.** Show 2–3 mockups as an artifact (layout, toolbar, annotation sidebar). The user picks one before any reader code is written.

**Engine:** pdf.js `PDFViewer` (`pdfjs-dist/web/pdf_viewer.mjs`), which provides:
- page virtualization
- a selectable text layer
- links
- search within the document

`build-renderer.mjs` must also output `pdf.worker.mjs` and the viewer CSS.

**File access:**
- Add an IPC handler `get-attachment(itemId)`: main looks up the path in the DB and returns the bytes, so the renderer never passes file paths.
- Restrict the existing `read-file` handler, which can read any path on disk, to `vashira_storage`.

**Opening a PDF:**
- Double-clicking an item, or "Open PDF" in the detail panel, opens the reader in place of the library, with a back button.
- "Open in system viewer" stays as a fallback.
- The reader remembers the last page per item.

**Annotations v1:**
- Types: highlight (5 colors), underline, sticky note, and rectangle/image area. Any of them can carry a comment.
- An annotation list in a sidebar, with jump-to-page, edit and delete.

**Viewer controls:** zoom, fit width, dark reading mode, thumbnails/outline, and Ctrl+F search.

**Storage:**
- Extend the existing, unused `annotations` table with `page`, `rects`, `text`, `comment` and `updatedAt`. `rects` is JSON in PDF coordinates, so zoom doesn't matter.
- Extend the Schema Guard to cover `annotations`, not just `items`.

**Annotations are data too:**
- Included in Deep Search.
- "Add annotations to note" (Markdown with page numbers).
- "Export annotations as Markdown".
- Phase 4 can summarize them.

**Not in v1:**
- freehand ink
- EPUB
- writing annotations into the PDF file itself (later, via pdf-lib)
- OCR for scanned PDFs (area annotations still work on them)

**Also:** Tour steps for the reader.

**Done when:**
- Annotations survive a restart and reopen in the right spot at any zoom level.
- A headless test covers annotation create/read/update/delete and migrating an old DB.

**Your test:**
- Open a PDF, highlight a passage and add a comment.
- Restart and confirm both are still there.
- Search inside the PDF.

## Phase 4 — Free local AI (v11.1)

**How it stays free:** the models run on the user's own computer. Nothing is bundled in the installer. The user clicks "Enable AI", and the model downloads once from Hugging Face into the app's data folder, with progress, resume and a delete button.

**4.1 Engine: `node-llama-cpp` v3.** It has prebuilt binaries for Windows, Linux and macOS, and runs on the CPU or on the GPU via Vulkan/Metal. Constraints from its docs:
- It runs in the main process only.
- It must stay out of the esbuild bundle (`--external:node-llama-cpp`). It's an ES module, so load it with dynamic `import()`.
- Its binaries must be unpacked from the asar, via `packagerConfig.asar.unpack` or the already-installed but unused `plugin-auto-unpack-natives`.
- It can't be cross-packaged, so each OS builds its own package. The CI matrix (D1) already does that.
- Measure the package size. If the CUDA binaries bloat it, ship CPU + Vulkan only.

**4.2 Smart (semantic) search:**
- **Model:** a small multilingual embedding model, ~100–150 MB. The library mixes English, French and Spanish, so English-only models are out.
- **Indexing:** split Phase 0's per-page text into ~500-token chunks and store their vectors in SQLite as BLOBs.
- **Ranking:** brute-force cosine similarity (fast enough up to ~100k chunks), blended with FTS5 keyword ranking.
- Results show the page.

**4.3 Assistant.** Two model tiers, suggested based on the computer's RAM:

| Tier | Download | Model class | RAM | |
|---|---|---|---|---|
| Light | ~1 GB | ~2B parameters | 8 GB is fine | default |
| Better | ~2.5 GB | ~4B parameters | 16 GB recommended | |

The models must be multilingual and permissively licensed (Apache-2.0 or MIT). Pick the best current ones at implementation time; today's candidates are the Qwen3 1.7B and 4B.

Features:
- **Summarize a paper** (TL;DR, findings, methods, limitations), saved as a note. Long PDFs are summarized section by section, then combined.
- **Ask about one paper, a collection or the whole library.** Answers cite sources as [Author Year, p. X], and clicking a citation opens the reader at that page.
- **Suggest tags for new imports**, preferring tags already in the library. The user confirms; tags are never added silently.
- **From the reader:** "Explain / summarize this selection" and "Summarize my highlights".

Expectations to state in the UI:
- On a laptop without a GPU, a summary can take a minute or two.
- Small models are good at summaries and tagging but weaker at hard reasoning, which is why every answer shows its sources.

**4.4 Other providers (optional),** in Settings → AI:
- Built-in (default).
- Ollama or LM Studio, auto-detected on `localhost:11434` / `:1234`.
- Your own API key, for an OpenAI-compatible service or Anthropic.

Fix three bugs in `oracle.ts` along the way:
- It demands an API key even for local servers.
- It sends the system prompt as a message, which Anthropic's API rejects; it must be a top-level `system` field.
- Its presets name retired models.

**Later:** make the stub "AI Provider" server on `:51236` real (OpenAI-compatible + MCP over the library), so other tools can use Vashira's local AI.

**Done when:**
- A headless test embeds sample pages and returns the right chunk for a paraphrased question.
- A summary of a 20-page paper completes on CPU.
- The app works normally with AI disabled.

**Your test:** enable AI, summarize a paper, ask a question, and click a citation.

## Distribution track

**D1 — Linux & Mac builds in CI (ships with v10.2).** Turn `.github/workflows/release.yml` into a matrix. Each OS builds natively, as `better-sqlite3` requires today and node-llama-cpp will later.
- **Windows (unchanged):** portable zip.
- **Linux (`ubuntu-latest`):**
  - `.deb` via the existing `maker-deb`, as the main format.
  - AppImage via `@reforged/maker-appimage`, which supports Forge 7.
  - Ubuntu 24.04+ blocks Electron's sandbox inside AppImages (AppArmor), so the AppImage may need a `--no-sandbox` launcher. The `.deb` doesn't.
- **macOS (`macos-latest`, Apple Silicon):** zip.
  - Forge's fuses plugin already re-applies the free ad-hoc signature that Apple Silicon needs to launch the app.
  - Users open it once via System Settings → Privacy & Security → "Open Anyway", or run `xattr -cr /Applications/Vashira.app`. The README gets these steps.
  - Intel Macs only if a free Intel runner is still available.
- **Testing limits:** CI proves these builds succeed, but nobody can launch-test Mac or Linux yet. Find a friendly tester.

**D2 — Privacy policy + downloads page (ships with v10.2).** Add `vashira-org/privacy.html`, stating exactly what leaves the computer:
- **Local-network P2P** (only if enabled): titles, DOIs, file hashes and IP address.
- **Global Mesh:** node ID and IP address, sent to `peers.vashira.io`.
- **Metadata lookups:** the identifiers and queries looked up, sent to CrossRef, OpenAlex, arXiv and Open Library.
- **Zotero sync:** only if configured.
- **AI:** local by default. With an external provider, the question and the relevant excerpts go to that provider.
- **Model downloads:** from Hugging Face.
- **No analytics or telemetry.**

Both landing pages and the README get per-OS download buttons, plus a Store badge once the listing is live. The Store listing requires the privacy page's URL.

**D3 — Microsoft Store (once v10.2 ships and the account exists).**
- **Packaging:** add `@electron-forge/maker-msix` (7.11.x, matching Forge) with `sign: false`, since the Store signs the package itself. Fill in the identity values from Partner Center. Versions map to four parts (10.2.0 → 10.2.0.0).
- **Each release:** CI attaches the `.msix` to the GitHub release. You upload it in Partner Center with the listing:
  - description and screenshots
  - privacy policy URL
  - age-rating questionnaire
  - category: Productivity or Education

  Certification usually takes a few days.
- **First submission:** use a *private audience* (only people with the link can find it) to test the Store install, then make it public.
- **Check before submitting:**
  - The Store version keeps its data in a private per-app folder, so it may not see a library from the portable version. Verify this, and add "Import library from portable install" if needed.
  - P2P's UDP port will trigger a Windows Firewall prompt, the same as today.
- **Bonus:** Store apps can also be installed with `winget`.
- **Later:** automate uploads with Microsoft's Store CLI.

**D4 — Paid Mac signing (optional, $99/year).** Only worth it if Mac users become important.

## Rules for every phase

- Wire component → `preload.ts` → `main.ts` together. New `items` columns go in both CREATE TABLE and `requiredColumns`.
- New controls get `data-tour` attributes and Tour steps.
- Each release updates CHANGELOG.md and CLAUDE.md (for architecture changes) and bumps the version.
- Verify with:
  - `npm run build` and `npm run lint`
  - headless Electron-as-Node scripts for anything touching the DB, PDFs or the AI engine
  - the user's test checklist for the UI
- P2P stays metadata-only. Discovery and open-access downloads go directly to the source, never through peers.

## Not planned

- Paid Windows code signing: the Store replaces it.
- Peer-to-peer file sharing: settled, out of scope.
- A Vashira cloud/sync server.
- Bundling AI models inside the installer.
