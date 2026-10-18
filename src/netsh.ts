import {spawn} from 'node:child_process';
import {join} from 'node:path';

const commands = {
    drivers: ['wlan', 'show', 'drivers'],
    interfaces: ['wlan', 'show', 'interfaces'],
    networks: ['wlan', 'show', 'networks', 'mode=bssid'],
} as const;

export type WifiCommand = keyof typeof commands;

// Наследуем потоки: не декодируем локализованный вывод как UTF-8.
// Пока возвращаем исходный вывод ОС, а не нормализованные измерения.
export function runNetsh(command: WifiCommand): Promise<number> {
    if (process.platform !== 'win32') {
        throw new Error('Для сбора данных через netsh требуется Windows.');
    }

    const windowsDirectory = process.env.SystemRoot;
    if (!windowsDirectory) {
        throw new Error('Не найдена переменная SystemRoot с путём к Windows.');
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
                reject(new Error(`netsh прерван (${signal}); лимит выполнения — 30 секунд.`));
                return;
            }
            resolve(code ?? 1);
        });
    });
}
