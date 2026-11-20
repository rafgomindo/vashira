# Vashira (वशीर) 7.0: Sovereign Archiver Edition

<div align="center">
  <img src="vashira-app/public/favicon.png" width="128" height="128" />
  <h2>The Ultimate Sovereign Research Mastery Hub.</h2>
  <p>A professional, decentralized, and AI-augmented alternative to Zotero.</p>
</div>

---

## 🏛️ The Vision
Vashira 7.0 is the definitive **Sovereign Research Hub**. Engineered with **European Integrity**, it eliminates reliance on proprietary cloud silos. 

Vashira creates a **Mastery Vault** with **Decentralized P2P Synapse**, **AI RAG Intelligence**, and **High-Fidelity Web Archiving**. Your research is synchronized via DHT across your devices, indestructible and private.

## 💎 Premium Features
- **Vashira Sentinel (9.0)**: Advanced browser extension with high-precision Google Scholar, arXiv, and PubMed scrapers.
- **Deep Reader (8.0)**: Dual-pane PDF annotation engine with real-time insight layering and sticky notes.
- **Sovereign Branding**: Unified high-fidelity identity across Desktop, Web, and Extension.
- **Sovereign Archiver (7.0)**: Automatic high-fidelity visual/structural snapshots of every research site.
- **The Oracle (5.0)**: RAG-powered AI interrogation of your entire collective knowledge.
- **The Scribe (5.0)**: A master-grade Markdown editor with integrated citation engine.
- **P2P Synapse Discovery**: Real-time peer-to-peer DOI discovery over decentralized node broadcasts.
- **Smart Flows & Semantic Labels**: Dynamic metadata-driven collection system and color-coded visual indexing.

## 🚀 Getting Started

### Prerequisites
- Node.js 22.12 or newer (required by Electron 44)
- No C++/Python toolchain needed: `better-sqlite3` ships prebuilt binaries for Windows, macOS and Linux

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/rafgomindo/vashira.git
   cd vashira/vashira-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Hub:
   ```bash
   npm start
   ```

### 📥 Download

Get the latest version from the [releases page](https://github.com/rafgomindo/vashira/releases).

- **Windows**: download `Vashira-Portable-…-win32-x64.zip`, unzip it anywhere, and run `Vashira.exe`. Windows may show a SmartScreen warning the first time ("More info" → "Run anyway") because the app isn't code-signed. A Microsoft Store version without that warning is on the way.
- **macOS (Apple Silicon)**: download `Vashira-…-macos-arm64.zip`, unzip it, and move `Vashira.app` to Applications. The app isn't notarized by Apple, so the first launch is blocked: open **System Settings → Privacy & Security**, scroll down and click **Open Anyway**. (Or, in Terminal: `xattr -cr /Applications/Vashira.app`.)
- **Linux**: the `.deb` is recommended for Ubuntu/Debian (`sudo apt install ./vashira_….deb`). The `.AppImage` runs without installing (`chmod +x` it first). If the AppImage won't start on Ubuntu 24.04 or newer, run it with `--no-sandbox`, or use the `.deb` instead.

What Vashira sends over the network, and when, is described in the [privacy policy](https://vashira.org/privacy.html).

### 🛠️ Distribution & Building

CI (`.github/workflows/release.yml`) builds all three platforms on every `v*` tag push and publishes one GitHub Release. A manual run from the Actions tab builds everything without publishing. Each OS builds on its own runner, because native modules can't be cross-packaged.

To build locally (from `vashira-app/`):
- **Windows portable**: `npm run package` → `out/Vashira-win32-x64/`. Zip that folder.
- **macOS** (on a Mac): `npm run package` → `out/Vashira-darwin-arm64/Vashira.app`.
- **Linux** (on Linux): `npm run build && npx electron-forge make --targets @electron-forge/maker-deb,@reforged/maker-appimage` → `out/make/`.

> The Squirrel `.exe` installer (`npm run make` on Windows) isn't used: it would be unsigned, and its zip step fails on current Node.js. Warning-free Windows installs will come from the Microsoft Store instead. See [ROADMAP.md](ROADMAP.md).

## ⚖️ License & Philosophy
The name **वशीर (Vaśīra)** is derived from Sanskrit, meaning *"The one who possesses mastery"*. Vashira is built on the principle that your research is your own dominion.

*Designed by "Le Rafael" 😎 @ [Ram0nes.com](https://ram0nes.com)*
