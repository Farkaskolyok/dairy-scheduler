# Pöttyös Beosztás

Laboráns műszakbeosztó tejfeldolgozó üzemeknek. Havi beosztástervezés kéthavi
munkaidőkerettel, távollétek és dolgozói összeférhetetlenségek kezelésével,
létszám- és szabályellenőrzéssel, Excel-importtal, CSV-exporttal és nyomtatással.

## Local use

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
