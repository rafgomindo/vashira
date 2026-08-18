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
- Node.js (v18+)
- Python (for `better-sqlite3` native builds)

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

### 🛠️ Distribution & Building

To generate your own installers and portable versions for your OS:

#### Windows
- **Portable Version (recommended)**: `npm run package` -> Assembles the standalone app in `out/Vashira-win32-x64/`. Zip that folder for distribution — this is what the [releases page](https://github.com/rafgomindo/vashira/releases) ships, and what CI (`.github/workflows/release.yml`) builds automatically on a version tag push.
- **Installer (.exe)**: `npm run make` targets a Squirrel installer, but it's currently unsigned (no code-signing certificate — one costs money and isn't set up yet) and its zip-maker step fails on newer Node.js versions (`cross-zip` calls a removed `fs.rmdir` option). Until both are sorted, the portable build above is the real distribution path.

#### macOS
To build for macOS, you must be on a Mac (or using a CI/CD environment with macOS):
- **Apple Silicon/Intel App**: `npm run make` -> Generates `.dmg` or `.zip` to `out/make/zip/darwin/`

> **Note**: Building cross-platform installers (like a `.dmg` from Windows) typically requires specialized tooling or cloud runners. Standard `npm run make` targets your current OS.

## ⚖️ License & Philosophy
The name **वशीर (Vaśīra)** is derived from Sanskrit, meaning *"The one who possesses mastery"*. Vashira is built on the principle that your research is your own dominion.

*Designed by "Le Rafael" 😎 @ [Ram0nes.com](https://ram0nes.com)*
