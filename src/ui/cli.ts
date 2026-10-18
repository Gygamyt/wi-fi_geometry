import chalk, { chalkStderr } from 'chalk';
import { runNetsh } from '../collectors/netsh.ts';
import type { WifiCommand } from '../collectors/netsh.ts';
import { runSession } from './session.ts';
import { showNetworks } from './networks.ts';
import { runRecording } from './record.ts';

const help = `${chalk.bold.cyan('Wi-Fi Mapper')} — v0.2

Usage: npm run start — interactive session
        node src/cli.ts <command> — single command

  drivers      Adapter, driver, supported standards and bands
  interfaces   Adapter and current connection status
  networks     Visible networks with BSSID details
  networks --raw  Original netsh output without parsing
  record <BSSID>  Record signal history to a local JSONL file
    --count <n>        Samples, 1–1000 (default: 10)
    --interval <ms>    Wait between completed samples (default: 2000)
    --output <path>    New output file (default: measurements/<timestamp>.jsonl)
  --help       Help
  --clean      Interactive session with one result at a time (default)
  --history    Interactive session preserving previous output

Networks are shown as a table. Other commands and --raw preserve Windows output.
`;

const args = process.argv.slice(2);
const command = args[0];

async function executeCommand(command: WifiCommand, raw = false): Promise<number> {
    try {
        if (command === 'networks' && !raw) {
            return await showNetworks();
        }
        const exitCode = await runNetsh(command);
        if (exitCode !== 0) {
            console.error(chalkStderr.red(`netsh exited with code ${exitCode}. See the Windows message above for details.`));
        }
        return exitCode;
    } catch (error) {
        console.error(chalkStderr.red(error instanceof Error ? error.message : String(error)));
        return 1;
    }
}

if (args.length === 0 || (args.length === 1 && (command === '--clean' || command === '--history'))) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        console.error(chalkStderr.red('An interactive session requires a terminal. Use drivers, interfaces or networks; help: --help.'));
        process.exitCode = 2;
    } else {
        try {
            await runSession((selected) => executeCommand(selected), command === '--history' ? 'history' : 'clean');
            process.exitCode = 0;
        } catch (error) {
            console.error(chalkStderr.red(error instanceof Error ? error.message : String(error)));
            process.exitCode = 1;
        }
    }
} else if (args.length === 1 && (command === '--help' || command === '-h')) {
    console.log(help);
} else if (command === 'record') {
    process.exitCode = await runRecording(args.slice(1));
} else if (args.length === 2 && command === 'networks' && args[1] === '--raw') {
    process.exitCode = await executeCommand('networks', true);
} else if (
    args.length !== 1 ||
    (command !== 'drivers' && command !== 'interfaces' && command !== 'networks')
) {
    console.error(chalkStderr.red('Specify one command: drivers, interfaces or networks. Help: --help.'));
    process.exitCode = 2;
} else {
    process.exitCode = await executeCommand(command);
}
