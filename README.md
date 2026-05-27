# 🌌 KunTab (WXT)

<p align="center">
  <img src="public/icon/128.png" alt="KunTab Logo" width="80" height="80" />
</p>

<h3 align="center">KunTab</h3>

<p align="center">
  A premium, beautiful, and feature-rich Chrome New Tab browser extension for bookmarks management. Built with WXT, React 19, and TypeScript.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <a href="https://wxt.dev/"><img src="https://img.shields.io/badge/built%20with-WXT-blueviolet" alt="Built with WXT" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/framework-React%2019-blue" alt="React 19" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/language-TypeScript-blue" alt="TypeScript" /></a>
</p>

<p align="center">
  🇺🇸 <b>English</b> | <a href="README.zh-CN.md">🇨🇳 简体中文</a>
</p>

---

## ✨ Key Features

KunTab turns your browser's default New Tab page into an elegant, powerful dashboard centered around bookmark organization and daily utility.

### 🎨 Elegant Dashboard & UI Customization
- **Modern UI Elements**: Clean cards, translucent overlays, and glassmorphism styling that adapt seamlessly.
- **Custom Wallpaper**: Configure custom background images via setting URLs. Set contrast, background overlays, and blur intensity to ensure your content cards remain perfectly legible.
- **Multilingual Support**: Switch seamlessly between English and Simplified Chinese interfaces.
- **Deep Personalization**: Toggle between Light, Dark, or System Auto themes, customize font sizes, and enable a compact layout for maximum screen real estate.

### 🔍 Omnibox Search & Shorthand Shortcuts
- Custom default search engine configurations (Google, Baidu, Bing, GitHub, ChatGPT, YouTube).
- Direct address bar command shortcut prefixes. Type the prefix followed by your query to search specific platforms instantly:
  
  | Prefix | Search Engine | Example | Action |
  | :--- | :--- | :--- | :--- |
  | `g` | Google | `g react 19` | Search Google for "react 19" |
  | `bd` | Baidu | `bd kuntab` | Search Baidu for "kuntab" |
  | `b` | Bing | `b typescript` | Search Bing for "typescript" |
  | `gh` | GitHub | `gh wxt` | Search GitHub for repositories matching "wxt" |
  | `ai` | ChatGPT | `ai write a hook` | Send query "write a hook" directly to ChatGPT |
  | `yt` | YouTube | `yt lofi` | Search YouTube for "lofi" |

### 📂 Native Bookmarks Tree & Management
- Interactive sidebar displaying folder structures in real-time.
- Rich inline operations: create new folders, edit titles/URLs/parent folders, delete bookmarks, and mark bookmarks as "Frequently Used" links on the main grid dashboard.
- Custom dragging/sorting for frequently used bookmarks.
- Quick history list showing recently visited links using local caching.

### 💾 Safe Backup & Restoration
- **JSON Backup**: Export all custom bookmarks, folder hierarchies, dashboard settings, and quick links into a single secure file.
- **HTML Export**: Standalone bookmark export compatible with standard browsers.
- **Smart Import**: Import your backup file without breaking your setup. The built-in duplicate-handling mechanism skips duplicate URLs automatically instead of wiping out existing configurations.
- Safety checks protecting user configurations from corrupted files (up to 10MB file limit).

---

## 🛠️ Technology Stack

- **Extension Framework**: [WXT](https://wxt.dev/) (Next-gen Web Extension Framework)
- **Frontend Core**: React 19 & TypeScript
- **Styling**: Vanilla CSS (Tailwind compatible and highly responsive layout)
- **Icons**: Lucide React
- **Manifest Version**: Manifest V3 (MV3) compatible with modern Chrome and Firefox architectures.

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18.x or later recommended)
- npm (or yarn / pnpm)

### Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/kuntab.git
   cd kuntab
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   *This will launch a developer instance of Chrome with the extension automatically loaded and live-reloaded.*

4. **For Firefox development**:
   ```bash
   npm run dev:firefox
   ```

---

## 📦 Build & Package

To build the extension production bundle manually:

```bash
# Build for Chrome (creates .output/chrome-mv3)
npm run build

# Build for Firefox (creates .output/firefox-mv3)
npm run build:firefox

# Compile TypeScript and check errors
npm run compile

# Create a zip archive for Store publishing
npm run zip
npm run zip:firefox
```

---

## 🔧 Installing the Dev Build Manually

To run the built version on your daily browser:

### In Google Chrome / Edge
1. Open Chrome and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** (top right corner).
3. Click on **Load unpacked** (top left).
4. Select the `.output/chrome-mv3` folder inside your project directory.

### In Mozilla Firefox
1. Open Firefox and go to `about:debugging#/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select the `manifest.json` file inside the `.output/firefox-mv3` directory.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">Made with ❤️ by the KunTab Contributors</p>
