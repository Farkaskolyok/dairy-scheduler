# Pöttyös Beosztás

Laboráns műszakbeosztó tejfeldolgozó üzemeknek. Havi beosztástervezés kéthavi
munkaidőkerettel, távollétek és dolgozói összeférhetetlenségek kezelésével,
létszám- és szabályellenőrzéssel, Excel-importtal, CSV-exporttal és nyomtatással.

## Local use

### Windows desktop app

The Tauri desktop build opens directly in its own window and works offline.
Use the `*-setup.exe` installer in `src-tauri/target/release/bundle/nsis`.
It includes Microsoft's WebView2 offline installer, so the destination computer
does not need internet access, Node.js, Bun, or Rust to install or run the app.
The current build targets Windows 10/11, x64.

Prebuilt files for this checkout are also in `releases/windows`: use
`Pottyos-Beosztas-1.0.0-x64-Setup.exe` for installation, or
`Pottyos-Beosztas-1.0.0-x64.exe` directly on a PC with WebView2 already installed.
SHA-256 checksums are listed in `SHA256SUMS.txt`.

Schedules, employees, settings, and drafts autosave using the same
`potty-beosztas-v2` localStorage format as the web version. The desktop app has
its own WebView2 profile under the Windows user's app data directory, associated
with the stable app identifier `hu.pottyos.beosztas`. Keep this identifier and
the production app origin unchanged for updates to retain saved data. Desktop
saves are separate from the hosted website and local browser version; copying
the executable does not copy schedules. This build does not add cloud sync or
full backup/restore controls. Clearing the app's data removes its saves.

Excel import uses the local file picker. CSV export uses a native Save As
dialog, and printing uses the native WebView2 print command.

To build the installer, install the Rust stable MSVC toolchain and Visual Studio
C++ Build Tools (including the Windows SDK), then run:

```sh
bun install --frozen-lockfile
bun run desktop:build
```

The first build needs internet access to download Rust dependencies, the NSIS
packaging tools, and the WebView2 offline installer. The standalone executable
at `src-tauri/target/release/pottyos-beosztas.exe` needs WebView2 already installed;
distribute the setup installer when the destination's runtime is unknown.
This is a local unsigned build; release signing is not configured.

For desktop development:

```sh
bun run desktop:dev
```

`bun run build:desktop` builds only the browser assets in `dist-desktop`.
The desktop entry point reuses the web app's scheduler component; no local
HTTP server runs in the installed desktop app.

### Browser version

Requires Node.js 22.12 or later and Bun for the locked dependency installation.
The initial installation needs internet access:

```sh
bun install --frozen-lockfile
bun run build
bun run start
```

Open http://127.0.0.1:3000. After installing and building, the application runs
without internet access while its local server is running. The production
server binds only to this computer. Keep the complete `.output` directory when
copying a build to another computer with Node.js; run it with `scripts/start.mjs`
in the same directory layout.

For development:

```sh
bun run dev
```

The equivalent npm scripts also work after dependencies have been installed.

## Data and assets

Schedules, employees, settings, and drafts are saved in the browser's
`localStorage` under `potty-beosztas-v2`. Scheduling and Excel parsing happen
in the browser. CSV export creates a local download. Fonts, icons, styles, and
scripts are served locally; the application has no remote reporting hooks or
remote database connections.

Figtree is distributed under the SIL Open Font License; see `public/fonts/OFL.txt`.

Browser storage belongs to a browser profile and origin. The hosted app's data
does not automatically appear at the local address. Keep using the same local
address and port to retain local data, and do not clear the browser's site data.

## Stack

React, TanStack Start and Router, Vite, Nitro, Tailwind CSS, and SheetJS.
The Windows desktop build uses Tauri 2 and WebView2 with a separate Vite entry point.
