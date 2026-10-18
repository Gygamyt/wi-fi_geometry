import { cancel, confirm, intro, isCancel, log, outro, select } from '@clack/prompts';
import chalk from 'chalk';
import type { WifiCommand } from '../collectors/netsh.ts';
import { clearTerminal } from './terminal.ts';

export type OutputMode = 'clean' | 'history';

const titles: Record<WifiCommand, string> = {
    drivers: 'Wi-Fi adapter',
    interfaces: 'Current connection',
    networks: 'Available networks',
};

function showHeader(mode: OutputMode) {
    intro(chalk.bold.cyan('Wi-Fi Mapper'));
    log.info(`Output: ${mode === 'clean' ? 'one result at a time' : 'keep session history'}. Use ↑↓ and Enter. Ctrl+C to exit.`);
}

export async function runSession(
    execute: (command: WifiCommand) => Promise<number>,
    mode: OutputMode = 'clean',
): Promise<void> {
    if (mode === 'history') {
        showHeader(mode);
    }

    while (true) {
        if (mode === 'clean') {
            clearTerminal();
            showHeader(mode);
        }
        const command = await select<WifiCommand | 'exit' | 'toggle-output'>({
            message: 'What would you like to inspect?',
            options: [
                { value: 'drivers', label: 'Wi-Fi adapter', hint: 'driver, standards and bands' },
                { value: 'interfaces', label: 'Current connection', hint: 'interface and connection status' },
                { value: 'networks', label: 'Available networks', hint: 'table: SSID, BSSID, signal and channels' },
                { value: 'toggle-output', label: `Output mode: ${mode}`, hint: `switch to ${mode === 'clean' ? 'history' : 'clean'}` },
                { value: 'exit', label: 'Exit' },
            ],
        });

        if (isCancel(command)) {
            cancel('Session ended.');
            return;
        }
        if (command === 'exit') {
            outro('See you at the next experiment!');
            return;
        }

        if (command === 'toggle-output') {
            mode = mode === 'clean' ? 'history' : 'clean';
            if (mode === 'history') {
                log.info('History mode enabled. Future results will stay in the terminal.');
            }
            continue;
        }

        if (mode === 'clean') {
            clearTerminal();
            intro(chalk.bold.cyan(titles[command]));
        } else {
            log.step(chalk.bold(titles[command]));
        }
        console.log(chalk.dim('─'.repeat(Math.max(20, Math.min(process.stdout.columns || 80, 100) - 2))));
        const exitCode = await execute(command);
        console.log(chalk.dim('─'.repeat(Math.max(20, Math.min(process.stdout.columns || 80, 100) - 2))));
        if (exitCode === 0) {
            log.success('Command completed.');
        } else {
            log.warn('Could not complete the command. Check the details above or choose another action.');
        }

        if (mode === 'clean') {
            const back = await confirm({
                message: 'Return to the menu?',
                active: 'Back to menu',
                inactive: 'Exit',
                initialValue: true,
            });
            if (isCancel(back)) {
                cancel('Session ended.');
                return;
            }
            if (!back) {
                outro('See you at the next experiment!');
                return;
            }
        }
    }
}
