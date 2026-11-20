# 📜 Vashira Mastery: The Historical Record

This document tracks the sovereign evolution of Vashira from its inception to the Foundations Build (v10.2.0).

## [v10.2.0] - The Foundations Build (Current)
- **Real Full-Text Search**: The indexer used to scan raw PDF bytes, which on compressed PDFs (nearly all of them) stored PDF file syntax instead of the text — Deep Search and the Oracle were working from that. Text is now extracted page by page with pdf.js in a background process and stored in a ranked, accent-insensitive SQLite FTS5 index. The existing library is re-indexed automatically on first launch, and the library search box now also finds text inside PDFs, showing the page number and the matching passage.
- **Trash**: Items can finally be deleted. They go to a Trash first (restore anytime); emptying it removes the item, everything attached to it, and its stored file.
- **Safer Attachments**: Imported PDFs are stored in their own folder per item, so two files with the same name no longer overwrite each other.
- **Privacy Hardening**: The capture server (port 51235) and the AI provider endpoint (51236) now accept connections from this computer only — previously anyone on the same network could read the whole library. Peer replies contain bibliographic fields only (they used to include local file paths, which contain the OS username). Sharing on the local network is now opt-in: asked once (in the tour, or a one-time prompt) and switchable in Settings. API keys are encrypted with the OS keychain instead of plaintext localStorage.
- **Electron 44**: Upgraded from Electron 32, which stopped receiving security fixes in 2025. better-sqlite3 13 ships prebuilt binaries for every OS, so building no longer needs a C++/Python toolchain.
- **Linux & macOS Builds**: Every release now also ships a .deb and an AppImage for Linux and an Apple Silicon build for macOS.
- **Privacy Policy**: vashira.org/privacy.html describes exactly what leaves your computer and when.

## [v10.1.0] - The Working Build
- **Renderer Reconciliation**: Fixed a wide mismatch between the renderer's `window.vashiraAPI` calls and what `preload.ts` actually exposed — including a call on every launch to a method that didn't exist, which crashed React's effect phase with no boundary to catch it. Library loading, PDF import, item selection, and the custom window controls were all silently broken as a result.
- **Deep Search Repair**: Fixed a schema mismatch (`search_index.fullText` vs a nonexistent `content` column) that silently broke full-text indexing on every single PDF import.
- **Consensus Hardening**: The Consensus Registry now tracks distinct peers per vote instead of raw exchange count — one peer answering repeatedly could previously inflate a wrong title into apparent consensus. DOI'd items now defer to CrossRef instead of peer opinion. Also fixed the P2P metadata-request listener, which was bound to an event name (`discovery`) that was never actually emitted.
- **Collections & Tags**: Shipped the UI for the long-dormant backend — sidebar filtering by collection or tag, tag chips with add/remove, and a collection-assignment picker on the item record.
- **BibTeX/RIS & Citation Styles**: Added library-wide BibTeX/RIS import and BibTeX export, plus an offline APA/IEEE/MLA citation style picker (IEEE/MLA styles existed in code but were never wired up).
- **Sovereign Polish**: Refined the glass/border/shadow system app-wide and elevated the Peer Consensus / CrossRef verification panel to its own surface.
- **Guided Tour**: Replaced the old placeholder "welcome item" with a real first-run tour covering every screen and every working control, replayable from Settings.
- **Portable Distribution**: Established the portable ZIP as the real distribution path (the Squirrel installer needs a code-signing certificate we don't have yet) and automated building it via GitHub Actions on every version tag push.

## [v10.0.0] - The Omni-Mastery Horizon
- **Universal Sentinel**: Added support for Opera, Opera GX, Safari, and Microsoft Office.
- **Mastery Build**: Finalized production EXE with "Vashira Sentinel" branding.
- **Deep Reader**: Integrated robust annotation layer for PDFs.
- **Sovereign Privacy**: Excluded extension source from world-visible Git pushes.

## [v9.0.0] - The Sentinel Influx
- **Browser Extension**: Created the "Vashira Sentinel" for one-click web ingestion.
- **Glassmorphism 2.0**: Overhauled UI with advanced CSS blur and depth.
- **Auto-Downloader**: Implemented background PDF capture and proxying.

## [v8.0.0] - The Librarian & The Oracle
- **Librarian Hub**: Added a dedicated workspace for local PDF management.
- **Oracle Brain**: Integrated RAG-powered AI for literature interrogation.
- **Duplicate Shield**: Added DOI-based duplicate detection.

## [v7.0.0] - Consensus & P2P
- **Vox Populis**: Built the Consensus Registry for metadata verification.
- **P2P Discovery**: Enabled discovery of research between local nodes.
- **Barcode Scanner**: Integrated mobile-to-desktop bridge for physical books.

## [v6.0.0] - Extension Foundations
- **Sovereign Plugins**: Added the first plugin architecture for translators.
- **Metadata Expansion**: Added Publisher and Page Count fields.

## [v1.0.0 - v5.0.0]
- Initial core development of the Research Hub and basic SQLite storage.
- ESM transition and Electron-Forge integration.

---
*Vashira: Built for Mastery.*
