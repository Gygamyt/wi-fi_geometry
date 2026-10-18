# Wi-Fi Mapper

A research pet project exploring the Wi-Fi data available on Windows with a laptop's built-in adapter. The current v0.1 collects netsh output and displays network observations in a table. Measurement history, analysis, Rust and graphical interfaces are future work.

## Getting started

Requires Windows and Node.js 24.12 or newer. Install dependencies with `npm ci`; no build is required.

```powershell
npm run start
```

Without arguments, the CLI opens an interactive Clack session: **Wi-Fi adapter**, **Current connection**, **Available networks**, **Output mode**, and **Exit**. Use the arrow keys and Enter to select an action. Select Exit or press Ctrl+C in the menu to end the session.

```powershell
npm run start -- --clean    # Default: one result at a time
npm run start -- --history  # Preserve previous results in the terminal
```

In **clean** mode, the screen is cleared before each menu and result. Results stay visible until you confirm **Back to menu**; you can also choose **Exit**. In **history** mode, commands append their output and return directly to the menu. The **Output mode** menu item switches modes during the session; the choice lasts until exit. Use a startup flag to select the mode for the next session. Clearing depends on the terminal's support and is not a secure deletion of terminal logs.

Results have a separate heading and terminal-width separators. Available networks are parsed into an English table with one row per BSSID. Driver and interface details retain the original Windows layout.

For a single command:

```powershell
node src/cli.ts --help
node src/cli.ts drivers
node src/cli.ts interfaces
node src/cli.ts networks
node src/cli.ts networks --raw
```

You can also use `npm run start -- networks` or `npm run start -- networks --raw`. Direct commands preserve netsh failure codes and support output redirection. A decode or parse failure returns code 1 and shows the raw bytes with an explanation. The interactive menu requires a TTY for both input and output; otherwise, specify a command explicitly.

Chalk styles the help title and errors according to terminal color support. `networks --raw` forwards netsh output unchanged. Disable colors with `FORCE_COLOR=0` (PowerShell: `$env:FORCE_COLOR = '0'`).

## Network observations

The network parser supports English and Russian netsh field labels. Each BSSID produces a separate observation with `ssid`, `bssid`, `signalQualityPercent`, `bandGHz`, `channel` and `radioType`. Missing or invalid measurements remain `null`; hidden SSIDs remain empty strings. The table displays these as an em dash and `(hidden)` respectively. Signal quality is a percentage, not measured RSSI in dBm. No band, frequency or distance is inferred from other fields.

Only this subset is currently normalized; authentication, encryption, rates and other fields remain available through `networks --raw`. No observations are saved to disk. Network names remain in their original language; terminal control sequences are removed from table labels for display without changing the parsed values.

Captured network output is decoded strictly as UTF-8 by default, with UTF-16 byte-order mark detection. `chcp` is not used to guess the encoding: the observed redirected encoding can differ from the console code page. If your driver emits a different encoding, set it explicitly before running the CLI:

```powershell
$env:WIFI_MAPPER_ENCODING = 'ibm866'
npm run start -- networks
Remove-Item Env:WIFI_MAPPER_ENCODING
```

Another supported label is `windows-1251`. This setting affects captured network text only. Unsupported output or decoding failures fall back to raw bytes and an error instead of claiming that no networks exist. Only an explicit zero-network message is treated as an empty scan. Other netsh languages are not supported by the parser yet; use raw mode for inspection.

## Language

All project-owned text is English for now, including prompts, comments, tests and documentation. Localization is planned for a later stage; no i18n framework or language selection is implemented yet. Windows messages and network names retain their original language.

## Development

Use **npm** only. `package-lock.json` pins dependency versions; use `npm ci` for repeatable installation and `npm install` when changing dependencies.

```powershell
npm run typecheck
npm run lint
npm run lint:fix
npm test
npm run test:run
```

- `typecheck` checks types without generating JavaScript.
- `lint` checks JS/TS code and formatting.
- `lint:fix` applies available fixes using the style in `src/cli.ts`: four spaces, single quotes, semicolons and no spaces inside braces.
- `test` runs Vitest in watch mode and reruns related tests after changes. Press `q` or Ctrl+C to exit.
- `test:run` runs the tests once and exits.

Tests live beside the implementation in `*.test.ts` files. Add tests for new logic, errors and edge cases. Current tests cover the CLI, interactive session and netsh wrapper using mocks; they do not require real Wi-Fi hardware or Windows permissions. They do not verify the actual driver or scan freshness.

Node.js executes TypeScript by stripping supported type annotations; it does not check types or read `tsconfig.json`. Type checking includes source files, tests and the Vitest configuration. Key compiler settings:

- `NodeNext`: Node.js module and import resolution rules, respecting `type: module`.
- `allowImportingTsExtensions`: permits `.ts` import extensions, preventing TS5097.
- `noEmit`: checks types without generating JavaScript; Node.js runs the source files.
- `strict` and `noUncheckedIndexedAccess`: strict checks, including potentially missing array elements.
- `verbatimModuleSyntax` and `erasableSyntaxOnly`: enforce syntax compatible with direct execution in Node.js.
- `types: ["node"]` and `lib: ["ES2024"]`: Node.js and JavaScript APIs without browser globals.

TypeScript and `@types/node` are development dependencies.

## Project structure

```text
AGENTS.md                Entry point for agent instructions
docs/agents/
  project-rules.md       Project rules and iteration scope
README.md                Usage, commands and limitations
package.json             Scripts and dependencies
package-lock.json        Pinned npm dependency versions
tsconfig.json            Type checking without a build
eslint.config.js         Code checks and formatting rules
vitest.config.ts         Node.js environment and mock isolation
src/
  cli.ts                 Command selection, help and errors
  cli.test.ts            CLI behavior tests
  netsh.ts               Windows process access
  netsh.test.ts          Process startup and completion tests
  network-parser.ts     Network observation types, decoding and parsing
  network-parser.test.ts  Synthetic English/Russian output tests
  networks.ts            Network collection and table presentation
  networks.test.ts       Table, error and raw fallback tests
  session.ts             Interactive Clack menu
  session.test.ts        Repeated selection and exit tests
  terminal.ts            Terminal screen and scrollback clearing
  terminal.test.ts       TTY and redirected output checks
```

Available fields depend on the Windows version, driver and system language. The CLI launches netsh directly without a shell. Raw commands inherit its streams; table mode captures stdout and stderr as bytes with a 30-second timeout and a 2 MiB limit per stream. Raw redirected output retains the encoding used by netsh; UTF-8 is not guaranteed.

## Commands and available data

| CLI | Windows command | What to inspect |
| --- | --- | --- |
| `drivers` | `netsh wlan show drivers` | Adapter model and driver, advertised standards and bands |
| `interfaces` | `netsh wlan show interfaces` | Interface state and current connection details |
| `networks` | `netsh wlan show networks mode=bssid` | Visible networks and individual BSSID details |

Run these Windows commands directly in PowerShell to compare their output with the CLI.

The network list typically includes SSIDs, BSSIDs, signal quality percentages, radio types, channels and security settings. Bands and additional fields depend on the system. Listing a network does not require connecting to it and does not grant access to its traffic or clients. Current connection details, including transmit and receive link rates, apply to your own connection.

- An SSID is a network name; several BSSIDs can share it.
- A BSSID identifies a BSS, usually through an access point interface MAC address. It does not necessarily identify a separate physical router.
- Signal quality percentages are not measured RSSI in dBm. If Windows reports RSSI separately, treat it as a separate field.
- A channel number without a band can be ambiguous. Do not invent an exact frequency when none is reported.
- Driver support for a band or standard does not mean networks of every supported type are currently visible.
- Output may reflect the Windows cache. Calling `show networks` does not guarantee a fresh scan.
- These commands do not provide CSI, time of flight or room geometry. Signal quality percentages do not establish walls or distances.

## When Windows denies access

Read the original Windows message first. On modern Windows versions, access to BSSIDs and some connection details is tied to location permission.

If netsh explicitly requests location permission, open **Settings > Privacy & security > Location** (`ms-settings:privacy-location`), review permissions and repeat the command. The CLI does not change permissions automatically.

If error 5, Access denied or requires elevation persists, investigate the execution context and Windows policies separately. Running as administrator is not a universal fix for location permissions. Missing interfaces and unavailable WLAN services are reported by netsh.

## First-step completion criteria

Run all three commands and inspect the fields and access restrictions on this laptop. Then review the output together and choose one field for the next small v0.1 change. Do not commit real SSIDs, BSSIDs or MAC addresses.

Table and raw network output validation is recorded in [the v0.1 validation report](docs/validation-v0.1.md), including live Windows checks, automated coverage and remaining limits.

## References

- [Microsoft: netsh wlan](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/netsh-wlan)
- [Microsoft: Wi-Fi access and location changes](https://learn.microsoft.com/en-us/windows/win32/nativewifi/wi-fi-access-location-changes)
- [Node.js: TypeScript execution](https://nodejs.org/api/typescript.html)
