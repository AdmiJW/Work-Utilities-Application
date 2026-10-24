# Work Utilities

A browser-only workspace for preparing SQL Server scripts and reading DER/DPR execution output. It provides independent, autosaved tool tabs, exact-text data inspection, Excel export, and offline use after the application has cached itself.

Application data stays in the browser. There is no application backend, database connection, account system, analytics, or remote processing service.

## Start developing

Requirements: **Node 24.15+ within the Node 24 release line**, npm, and a current desktop Chrome or Edge browser.

1. Run `npm ci`.
2. Copy `.env.example` to `.env.local` and set your own `PRIMEUI_LICENSE_KEY`.
3. Run `npm start` and open [localhost:4200](http://localhost:4200).

The start/build scripts load `.env.local` and generate an ignored TypeScript configuration file. Real keys and generated configuration are excluded from Git and the Docker build context. Environment variables can supply the key instead of a local file; `PRIMEUI_LICENSE_KEY_FILE` also supports reading a UTF-8 key file.

PrimeNG 22 uses PrimeUI Community/Commercial licensing. Eligible individuals can obtain a Community key; Community keys require annual renewal. Verification is offline. See the [vendor’s licensing documentation](https://primeui.dev/licenses/community). The key is a browser-build input, not a server-side secret; the application keeps the vendor’s verification mechanism intact.

The Angular development server does not enable the service worker. To exercise the production PWA locally:

```sh
npm run build
npm run preview
```

Open [127.0.0.1:4173](http://127.0.0.1:4173) and wait for **Offline ready** before disconnecting. This status waits for a controlling service worker and an acknowledged Angular worker operation after initialization/prefetch.

## Use the tools

### SQL Formatter

- Click the tool in the sidebar to create a new session. **Open SQL**, or dropping a `.sql` file on the editor, imports into that current session without renaming it.
- Import one file at a time. Empty content loads directly; otherwise choose **Replace all**, **Insert at cursor**, or **Cancel**. Insert replaces the last selection like a normal paste. Multiple-file attempts and invalid file encodings show an error without changing content.
- **Prettify** formats Transact-SQL with four-space indentation while retaining comments.
- **Word Wrap** toggles visual wrapping and is remembered per session. It does not alter physical lines or exported SQL. Ctrl+Left/Right navigates by word; adding Shift selects words.
- **One-line** removes comments, collapses whitespace outside quoted values, places each statement on one physical line, and adds its final semicolon. Put semicolons between statements yourself.
- One-line supports standalone SELECT, INSERT, UPDATE, and DELETE statements, including nested expressions and CTEs. Procedural scripts, GO batches, unclosed quotations/comments, and physical newlines inside quoted values receive an error instead of being rewritten.
- Formatting and file imports are undoable through the editor. New empty sessions use LF line endings; full-file replacements adopt the imported LF/CRLF convention.
- **Export SQL saves the current editor text exactly.** Click One-line explicitly when that is the format you need. The tab name determines the sanitized download filename; request/domain filename automation is deferred.

SQL is never executed by this application. Monaco provides local SQL highlighting, navigation, search, and editing without a database/schema connection.

### DER/DPR Output Analyzer

Paste output into the source textarea, use **Open TXT**, or drop one `.txt` file on the source section, then select **Analyze output**. TXT importing follows the same empty/Replace/Insert/Cancel behavior as SQL importing and retains the tab name. Dropping onto a collapsed source section also works; successful importing expands it. Files are decoded locally as UTF-8 or BOM-marked UTF-16. The first completed analysis collapses the source pane; its toggle lets you reopen it for edits.

The expected protocol is described in [sql_output_format.md](sql_output_format.md). For example:

```text
SQL Statement Run: --123SELECT CONCAT(Customer.Id, '|', Customer.Status) FROM Customer
000123|ACTIVE

SQL Statement Run: --123SELECT CONCAT(Customer.Id, '|', Customer.Status) FROM Customer WHERE Id = 'missing'
0 rows affected
```

- Each SELECT gets its own sheet in execution order, including repeated tables and zero-row results.
- Columns are recovered from pipe-delimited CONCAT/CONCAT_WS projections. Joins, nested expressions, TOP, DISTINCT, and CTEs are supported within the documented projection shape. Qualified references stay as written (`d.EventId`, `DeliveryAttempt.EventId`); computed fields use exposed aliases or the complete expression. Duplicate labels are distinguished. These labels also appear in the inspector and Excel headers.
- Non-SELECT statements appear under **Statements**, retaining SQL, reported affected-row counts, and messages.
- Valid JSON objects, arrays, and quoted JSON strings are recognized as complete fields, so a pipe inside them does not split the column.
- Values remain strings. Leading zeros, long numbers, whitespace, datetime precision, and JSON escaping are retained. Grid sorting/filtering uses text semantics.
- Unsupported projections and inconsistent field counts retain the original rows under **Diagnostics**. Valid rows remain available. Diagnostics show the statement and original source line.
- Input edits mark previous results stale and disable export until another analysis completes.
- Double-click a cell (or press Enter on a focused data cell) to open its inspector. While open, single clicks and keyboard navigation update it. Closing keeps it hidden until a double-click or the right-edge toggle; the toggle uses the last selected cell, or prompts you to select one.
- The whole inspector scrolls vertically when space is tight, including its heading and controls. Focus the inspector region to use Page Up/Down or Tab through its controls. Tree and Pretty viewers retain a minimum 180px height and their own scrolling for long content; raw-value resizing and manual collapsing remain available. This also applies to the narrow-screen overlay.
- JSON has Tree and Pretty views. **Shallow** parses the outer JSON and retains individual nested-string **Decode** actions. **Deep** recursively expands serialized objects/arrays throughout the cell. The mode is remembered per session. Deep decoding preserves numeric text and duplicate properties, keeps ordinary/scalar strings unchanged, and stops at a 32-layer string budget with a notice. URL/percent decoding is outside this feature. Decoding changes inspection and Copy JSON only; raw copy, source text, and exports retain the original values.

Synthetic analyzer fixtures are collected in [`examples/der-dpr-output analyzer/`](examples/der-dpr-output%20analyzer/): basic results, JSON values, repeated patch before/after sequences, a 20-column row, 500 result rows, JOIN, CTE, and subquery examples, and a `CONCAT_WS` projection. All nine examples are covered by automated tests.

The [`examples/sql-formatter/`](examples/sql-formatter/) directory contains a complex CTE/query, a DER-style delimited extraction query, and multiple read-only statements for testing prettify and one-line formatting.

### Excel export

**Export Excel includes all valid parsed rows in original order**, independently of the current filters and sort order. SELECT sheets include SQL/run/count metadata above their headers. `_Statements` and `_Diagnostics` are included when relevant.

Data cells are literal Excel text, including strings beginning with `=`. No scientific notation, numeric/date coercion, or JSON reserialization is applied. Sheet names are sanitized and made distinct by their statement numbers.

Export validates Excel’s limits before downloading. A cell over 32,767 characters, over 253 line feeds, or an oversized worksheet blocks export and identifies the affected sheet/row/column. The complete content remains in the app; it is never silently truncated.

## Sessions and offline behavior

- Sidebar tool actions create new tabs. Double-click a tab or focus it and press **F2** to rename it; arrow/Home/End keys navigate tabs. Breadcrumbs and tool headings show that tab name. The bottom bar reports physical lines and characters for its source text.
- Drag a tab horizontally to reorder it; the order survives reload. Right-click a tab (or press Shift+F10 while focused) for **Close**, **Close to the Right**, **Close All**, and **Rename**. Close-to-right uses the displayed order and the targeted tab.
- Changes autosave to IndexedDB **10 seconds after the last edit**. Tab closure and application updates flush immediately; page hiding also requests a best-effort flush. Wait for **All changes saved** before closing the browser immediately after an edit. A sudden browser/process termination cannot guarantee an unfinished asynchronous write.
- Closing a tool tab keeps its saved content in **Session library**. Batch close saves every targeted session before archiving any; a failed save keeps those tabs open.
- With no tabs open, the homepage shows up to **eight recently viewed sessions**, including empty saved sessions, with quick actions for new sessions and Session Library. Select a row to reopen the same session and restore its saved tool state. The introductory homepage appears when there is no saved history.
- Recent ordering uses viewing time: creating, explicitly switching to, reopening, or restoring the initially active session records a view. Editing, autosaving, tab ordering, and closing sessions do not advance it. Older records initially use modification time (or creation time) and display **Updated** until first viewed in this version. Access timestamps are persisted as summary metadata without rewriting document bodies; pending autosaves cannot roll them back. Read failures leave the entry available for retry, and superseded reads cannot replace a newer navigation.
- Session Library supports Date (most recently updated first) or Name (A–Z) sorting, remembered between visits. Open/Closed chips distinguish current tabs from archived sessions.
- Select checkboxes to delete multiple sessions permanently. **Select all** selects current search matches, including open tabs. Changing the search or closing the library clears selection. Confirmation identifies open tabs that will close; a successful deletion cancels pending saves so they cannot recreate deleted entries.
- Source text and view preferences are persisted. Derived analysis results are reconstructed when a previously analyzed session is restored.
- Editor undo history remains available while its session is open. Browser reload/closing the tool releases in-memory editor history; saved text and view settings are restored.
- A browser lock permits one editing window per profile/origin. Another window can retry after the current owner closes.
- Sessions are specific to the browser profile and origin, including the port. There is no cloud sync or session backup/restore feature. Clearing site data also clears sessions and cached application assets.
- The production service worker precaches both tools, their workers, and their assets, including tools not opened online. Installation as a PWA is optional for cached browser-tab use.
- An update banner offers **Save and reload** after a new version finishes downloading. Failed pending saves prevent that reload. The session library also provides a manual update check.
- Production PWA operation requires HTTPS, with localhost permitted for development. Hosting/TLS setup is outside this repository’s scope.

## Architecture

The application uses Angular 22 standalone components, zoneless change detection, signals/computed state, PrimeNG 22 with a customized Aura preset, Tailwind CSS 4, and locally bundled Lucide icons through ng-icons.

```text
src/app/
  workspace/         shell, sidebar, tabs, session library, tool composition
  sql-formatter/     Monaco wrapper, formatter actions, editor model lifetime
  output-analyzer/   parsing, result sheets, inspection, diagnostics, XLSX
  sessions/          shared contracts, IndexedDB, autosave, workspace locking
  sql-language/      pure SQL tokenization and statement boundaries
  file-transfer/     one-file import flow, drop handling, text decoding and downloads
  appearance/        theme preferences and appearance state
  offline-support/   service-worker readiness, installation and updates
```

Each feature introduces only the layers it needs:

| Layer           | Responsibility                                                                        |
| --------------- | ------------------------------------------------------------------------------------- |
| `components/`   | Focused standalone views; substantial templates/styles colocated with their component |
| `state/`        | Signal state and explicit actions; tool runtime state keyed by session ID             |
| `functions/`    | Testable parsing, formatting, validation, and other computational logic               |
| `models/`       | Feature-owned data contracts                                                          |
| `adapters/`     | Browser APIs, persistence, and imperative SDK integration                             |
| `workers/`      | Feature-owned background job entry points                                             |
| `public-api.ts` | Deliberate cross-feature exports                                                      |

The root component/configuration and typed tool registry are composition points. Tools, tab controls, and Session Library are lazy-loaded; mounting a different session creates a separate view while its open-session state remains owned by the feature. Workers can continue while another tab is active and terminate when their session closes. CDK drag/drop owns horizontal tab movement; session state owns persistent order and batch lifecycle transactions.

`sessions` stores lightweight summaries separately from document bodies. Session payloads carry schema version 1 and source revisions; IndexedDB also declares its schema version. Future schema changes must migrate saved data deliberately. Source revisions keep old worker results from being mistaken for analysis of newly edited input.

Dependency rules are enforced through `eslint-plugin-boundaries`: tools cannot import one another, allowed dependencies must use `public-api.ts`, and foundational modules cannot depend on tool/workspace implementations. `npm run check:boundaries` verifies positive and negative examples instead of merely checking that a config exists.

Keep source files focused on a single concept, usually around 250 lines or less. This is a review guideline, not a hard line-count gate. Use descriptive names such as `parse-output-file.ts` / `parseOutputFile`; avoid catch-all helper files. Unit tests live beside their implementation. Prefer computed state over copying signals with effects; effects belong at imperative integration boundaries.

### Add another tool

1. Create a feature directory with its components, models, state, and functions as needed.
2. Add its identifier to `ToolId` and register its metadata/lazy component loader in the root tool registry.
3. Give the tool container a `sessionId` input. Persist serializable document options through `SessionState`; keep runtime SDK objects and derived results inside the feature.
4. Expose the container through `public-api.ts` and declare the feature’s allowed dependencies in the ESLint config.
5. Add colocated logic tests, a browser workflow, and README guidance. New compiled chunks are covered by the production precache patterns.

## Validation commands

```sh
npm run lint
npm run check:boundaries
npm run format:check
npm test
npm run build
```

`npm run check` runs those checks together. `npm run lint:fix`, `npm run format`, and `npm run test:watch` support development. Prettier sorts Tailwind classes and handles formatting; ESLint handles TypeScript, Angular templates, accessibility rules, and feature boundaries. There are no commit hooks. Raw SQL/TXT fixtures, generated files, and original protocol documentation are excluded from formatting.

For browser tests, first build the production app, then either install Chromium or select an installed browser:

```sh
npx playwright install chromium
npm run test:e2e
```

Set `PLAYWRIGHT_CHANNEL=chrome` or `PLAYWRIGHT_CHANNEL=msedge` to use the installed Chrome/Edge channel. In PowerShell, for example: `$env:PLAYWRIGHT_CHANNEL = 'msedge'` before running the test command. The harness starts the production preview automatically. `TEST_BASE_URL` can point it at an already running local container instead.

Browser coverage includes independent tabs, ordering/context menus, library selection/deletion, file Open/drop/insert/replace/undo, word navigation/wrapping, IndexedDB restoration, locking, shallow/deep JSON inspection, sorting/filtering with complete export, DPR summaries, oversized-cell blocking, cold offline workers, and a representative 20 MB file. Inspector regressions exercise mouse-wheel and keyboard scrolling at 1366×768, 1280×600, 1024×480, and the narrow 960×480 overlay, with expanded input, maximum raw-box height, long column names, both JSON views/modes, and desktop resizing. Recent-session coverage includes ordering, the eight-entry limit, empty/legacy history, retrying reads, deletion, restoration, and offline reopening; unit tests cover superseded navigation and stale autosave timestamps. Reports/screenshots/metrics are written to ignored `artifacts/` and `test-results/` directories; these generated directories can be removed after review.

Verified on **24 October 2026**: lint, five feature-boundary checks, formatting, 53 unit tests across 13 files, and the production build passed. All 21 browser workflows passed in Chrome and Edge without retries or skipped tests; the Edge suite ran against the Docker image. Light/dark layouts, a 50,000-row fixture, offline workers, save-failure handling, and the container's health/user/cache behavior were also checked. The dependency audit reported zero known vulnerabilities. Generated review artifacts are removed from the delivered workspace; the commands above regenerate them.

## Build the image

With Docker running and a key in `.env.local` or the environment:

```sh
npm run image:build
docker run --rm -p 8080:8080 workplace-utilities:local
```

The helper passes the key through a BuildKit secret without printing it and computes a non-secret `BUILD_REVISION` hash so renewed keys invalidate the compiled-build cache. A Docker engine with BuildKit is required. To call Docker directly, use `--secret id=primeui_license_key,env=PRIMEUI_LICENSE_KEY` and change `--build-arg BUILD_REVISION=...` when renewing the key. Never put a real key into the Dockerfile or a tracked command file.

The Dockerfile pins its Node 24 and unprivileged Nginx base images by digest. Its build stage installs locked dependencies, runs unit tests, and builds the production application. The final stage checks Nginx configuration with `nginx -t`. The final image contains static assets, listens on **8080**, runs as UID **101**, and includes an HTTP health check. It preserves revalidation for the HTML/service-worker manifests and long caching for hashed assets; missing asset requests return 404 rather than HTML.

There is no Docker Compose file or deployment automation. Configure your own domain, HTTPS, and reverse proxy separately.

Visible branding is **Work Utilities**. Internal Angular project, database, and local image identifiers retain `workplace-utilities` for compatibility with saved work. A hostname such as `work-utilities.admijw.xyz` needs no application-specific configuration.

## Known limits and troubleshooting

- **Ambiguous source format:** arbitrary unescaped pipes in ordinary text and NULLs omitted by CONCAT_WS can lose information. Detectable mismatches are diagnosed, but no analyzer can reconstruct every ambiguity from this format. CONCAT output also cannot distinguish empty strings from NULL. Blank physical lines are treated as separators.
- **Supported query shape:** column recovery expects a single CONCAT/CONCAT_WS projection, rather than `SELECT *`, multiple independent output expressions, or arbitrary result protocols. Only pipe delimiters are supported in v1.
- **Performance:** representative files around 20 MB are the design/test target, not an imposed format limit. Browser memory and unusually wide/deep values can constrain larger workloads. Parsing, inspection, and workbook writing use workers; result rendering is virtualized.
- **Save failed:** keep the session open and recover/export its content. Check available browser storage and retry saving. The application does not claim a failed write succeeded.
- **Offline not ready:** use a production build, keep the first visit online until Offline ready appears, and allow service workers. The development server intentionally does not cache an offline application.
- **License notice:** check the configured PrimeUI key and its renewal status. The real key belongs in ignored local/environment configuration.
- **Deferred capabilities:** domain/request filename generation, automatic CONCAT generation, grid editing, range copying, alternate delimiters, workspace backups/import, and concurrent editing windows.
