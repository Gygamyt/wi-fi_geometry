import {spawn} from 'node:child_process';
import {join} from 'node:path';

const commands = {
    drivers: ['wlan', 'show', 'drivers'],
    interfaces: ['wlan', 'show', 'interfaces'],
    networks: ['wlan', 'show', 'networks', 'mode=bssid'],
} as const;

export type WifiCommand = keyof typeof commands;

// Inherit streams to avoid decoding localized output as UTF-8.
// For now, forward raw OS output rather than normalized measurements.
export function runNetsh(command: WifiCommand): Promise<number> {
    if (process.platform !== 'win32') {
        throw new Error('Collecting data through netsh requires Windows.');
    }

    const windowsDirectory = process.env.SystemRoot;
    if (!windowsDirectory) {
        throw new Error('The SystemRoot environment variable containing the Windows path is missing.');
    }

    return new Promise((resolve, reject) => {
        const child = spawn(join(windowsDirectory, 'System32', 'netsh.exe'), commands[command], {
            stdio: 'inherit',
            shell: false,
            windowsHide: true,
            timeout: 30_000,
        });

        child.once('error', reject);
        child.once('close', (code, signal) => {
            if (signal) {
                reject(new Error(`netsh interrupted (${signal}); execution timeout is 30 seconds.`));
                return;
            }
            resolve(code ?? 1);
        });
    });
}
