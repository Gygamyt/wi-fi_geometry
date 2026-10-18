import { execFile, spawn } from 'node:child_process';
import { join } from 'node:path';

const commands = {
    drivers: ['wlan', 'show', 'drivers'],
    interfaces: ['wlan', 'show', 'interfaces'],
    networks: ['wlan', 'show', 'networks', 'mode=bssid'],
} as const;

export type WifiCommand = keyof typeof commands;

function getNetshPath(): string {
    if (process.platform !== 'win32') {
        throw new Error('Collecting data through netsh requires Windows.');
    }

    const windowsDirectory = process.env.SystemRoot;
    if (!windowsDirectory) {
        throw new Error('The SystemRoot environment variable containing the Windows path is missing.');
    }

    return join(windowsDirectory, 'System32', 'netsh.exe');
}

// Raw mode inherits streams without decoding or rewriting Windows output.
export function runNetsh(command: WifiCommand): Promise<number> {
    const executable = getNetshPath();
    return new Promise((resolve, reject) => {
        const child = spawn(executable, commands[command], {
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

export type NetshOutput = { exitCode: number; stdout: Buffer; stderr: Buffer };

export function captureNetworks(signal?: AbortSignal): Promise<NetshOutput> {
    const executable = getNetshPath();
    return new Promise((resolve, reject) => {
        execFile(executable, commands.networks, {
            encoding: 'buffer',
            windowsHide: true,
            timeout: 30_000,
            maxBuffer: 2 * 1024 * 1024,
            ...(signal ? { signal } : {}),
        }, (error, stdout, stderr) => {
            if (error && (typeof error.code !== 'number' || error.killed || error.signal)) {
                reject(error);
                return;
            }
            resolve({ exitCode: typeof error?.code === 'number' ? error.code : 0, stdout, stderr });
        });
    });
}
