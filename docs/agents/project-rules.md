# Wi-Fi Mapper project rules

## Goal and current scope
- This pet project explores Wi-Fi data on Windows using the laptop's built-in adapter.
- v0.1 network inspection is validated. The current scope is v0.2: repeated netsh observations and local measurement history.
- Work on one small technical task per iteration. Discuss Rust, graphical UI, mobile apps and reconstruction before moving to those stages.
- Do not make additional hardware a prerequisite.

## Collaboration
- Explain both how an implementation works and why it is appropriate.
- Prefer small working changes; avoid generating large amounts of code in advance.
- Offer alternatives when there is a meaningful tradeoff.
- Separate confirmed capabilities from hypotheses and state limitations explicitly.
- Write task and validation reports as English Markdown files in `ai_reports/`. That folder is gitignored; do not place generated AI reports in tracked documentation folders. Keep durable usage documentation in README.md and project rules in docs/agents/.

## Language and future localization
- English only for now: UI labels, choices, prompts, help, errors, comments, test descriptions, documentation and package metadata.
- Localization is planned for a later stage. Do not introduce translation catalogs, language selection or an i18n dependency until that work is explicitly requested.
- Preserve raw netsh output as returned by Windows, including its language and network names. The English-only rule applies to text owned by this project, not external data.

## Implementation
- TypeScript is the primary language. Rust may be introduced later for low-level collection.
- Use npm only and commit `package-lock.json`. Do not use pnpm or Yarn or add their lockfiles.
- JS/TS style: four spaces, single quotes, semicolons and no spaces inside import or object braces. `eslint.config.js` is the source of truth; use `npm run lint:fix` for fixes.
- Do not make Python mandatory without a concrete reason.
- Add dependencies and abstraction layers only when currently needed.
- Keep OS access separate from the CLI; introduce storage and analysis modules when those tasks arise.
- Organize source files by responsibility: collectors/ for OS collection and byte decoding, parsers/ for text interpretation, models/ for shared domain types, services/ for workflows, storage/ for persistence, and ui/ for CLI presentation. Keep src/cli.ts as a minimal entry point. Do not create empty folders or abstractions for hypothetical future work.
- Allow a future switch from netsh to Native Wi-Fi API without building a universal framework in advance.
- Account for netsh output localization and encoding; it is not a stable machine-readable format.
- Network parsing supports English and Russian OS labels; synthetic fixtures may contain those original labels. Keep missing measurements as null, empty SSIDs as empty strings, and provide raw output on request. Do not infer encoding from chcp; decode strictly and use WIFI_MAPPER_ENCODING for explicit overrides.
- Put all tests under src/tests/, separate from production modules: unit/ mirrors logical source folders, integration/ covers complete workflows, and fixtures/ may hold reusable synthetic input. Use `*.test.ts` names and cover successful behavior, errors and edge cases.
- Use `npm test` in watch mode during development. Mock OS calls in unit tests: do not run real netsh or depend on Wi-Fi hardware, Windows permissions or local measurements.

## Data and experiments
- Use real measurements; label demonstration data explicitly.
- Do not treat signal quality percentages as measured RSSI in dBm or as CSI.
- Do not interpret RSSI as reliable distance or wall positions.
- Do not promise geometry reconstruction without experimental evidence.
- Do not assume each netsh invocation triggers a fresh radio scan.
- Preserve original measurements for later analysis when storage is introduced.
- Record JSON Lines under measurements/ by default, preserving original stdout/stderr bytes as base64. Use explicit observed, missing and error statuses; a missing BSSID is not a 0% signal measurement. Timestamp collection start and completion without claiming a fresh radio scan.
- Never overwrite an existing recording. Run collection sequentially with a bounded sample count, support cancellation, and close files after success or failure.
- Do not commit real SSIDs, BSSIDs, MAC addresses or other local measurements.
- Do not read or export Wi-Fi passwords; they are not needed for the current task.

## Running and checking the current version
- Node.js 24.12+; help: `node src/cli.ts --help`.
- `npm run start` opens a Clack session. Return to the menu after each action; Exit and menu cancellation end the session.
- Default to clean output: clear before menus and results, and wait for confirmation before clearing a result. Support `--clean`, `--history` and switching modes in the menu. History mode must preserve output without clearing; direct commands must never clear the terminal.
- Preserve `npm run start -- <command>` for single execution and redirected output. Open the menu only in a terminal (TTY).
- Type checking: `npm run typecheck` after installing devDependencies.
- Install with `npm ci` when the lockfile exists; use `npm install` after dependency changes.
- Before completing JS/TS changes, run `npm run lint`, `npm run typecheck` and `npm run test:run`.
- Commands: `drivers`, `interfaces`, `networks` (table), `networks --raw` (original output).
- First v0.2 command: `record <BSSID> --count <n> --interval <ms> --output <new-file.jsonl>`. Recording is currently a direct CLI command, not a menu action.
- Use read-only `netsh wlan show` commands. Do not change OS settings or permissions automatically.
