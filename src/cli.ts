import chalk, {chalkStderr} from 'chalk';
import {runNetsh} from './netsh.ts';
import type {WifiCommand} from './netsh.ts';
import {runSession} from './session.ts';

const help = `${chalk.bold.cyan('Wi-Fi Mapper')} — v0.1, raw netsh output

Usage: npm run start — interactive session
        node src/cli.ts <command> — single command

  drivers      Adapter, driver, supported standards and bands
  interfaces   Adapter and current connection status
  networks     Visible networks with BSSID details
  --help       Help
  --clean      Interactive session with one result at a time (default)
  --history    Interactive session preserving previous output

Windows data and messages are displayed without parsing or conversion.
`;

const args = process.argv.slice(2);
const command = args[0];

async function executeCommand(command: WifiCommand): Promise<number> {
    try {
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
            await runSession(executeCommand, command === '--history' ? 'history' : 'clean');
            process.exitCode = 0;
        } catch (error) {
            console.error(chalkStderr.red(error instanceof Error ? error.message : String(error)));
            process.exitCode = 1;
        }
    }
} else if (args.length === 1 && (command === '--help' || command === '-h')) {
    console.log(help);
} else if (
    args.length !== 1 ||
    (command !== 'drivers' && command !== 'interfaces' && command !== 'networks')
) {
    console.error(chalkStderr.red('Specify one command: drivers, interfaces or networks. Help: --help.'));
    process.exitCode = 2;
} else {
    process.exitCode = await executeCommand(command);
}
