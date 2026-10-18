import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {runNetsh} from './netsh.ts';

vi.mock('./netsh.ts', () => ({runNetsh: vi.fn()}));

const originalArgv = process.argv;
const originalExitCode = process.exitCode;

async function runCli(args: string[]) {
    process.argv = ['node', 'cli.ts', ...args];
    await import('./cli.ts');
}

beforeEach(() => {
    vi.resetModules();
    process.exitCode = undefined;
    vi.mocked(runNetsh).mockResolvedValue(0);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    process.argv = originalArgv;
    process.exitCode = originalExitCode;
});

describe('CLI', () => {
    it.each([[], ['--help'], ['-h']])('показывает справку для %j', async (...args) => {
        await runCli(args);
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Запуск:'));
        expect(console.error).not.toHaveBeenCalled();
        expect(runNetsh).not.toHaveBeenCalled();
        expect(process.exitCode).toBeUndefined();
    });

    it.each(['drivers', 'interfaces', 'networks'])('выполняет команду %s', async (command) => {
        await runCli([command]);
        expect(runNetsh).toHaveBeenCalledExactlyOnceWith(command);
        expect(console.error).not.toHaveBeenCalled();
        expect(process.exitCode).toBe(0);
    });

    it.each([
        ['unknown'],
        ['networks', 'extra'],
        ['--help', 'extra'],
        ['networks', '&&', 'echo'],
    ])('отклоняет недопустимые аргументы %j', async (...args) => {
        await runCli(args);
        expect(process.exitCode).toBe(2);
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Укажите одну команду'));
        expect(runNetsh).not.toHaveBeenCalled();
    });

    it('передаёт код ошибки netsh и выводит пояснение', async () => {
        vi.mocked(runNetsh).mockResolvedValue(5);
        await runCli(['networks']);
        expect(process.exitCode).toBe(5);
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('кодом 5'));
    });

    it.each([
        [new Error('Нет доступа'), 'Нет доступа'],
        ['Неизвестная ошибка', 'Неизвестная ошибка'],
    ])('обрабатывает исключение %s', async (error, message) => {
        vi.mocked(runNetsh).mockRejectedValue(error);
        await runCli(['networks']);
        expect(process.exitCode).toBe(1);
        expect(console.error).toHaveBeenCalledWith(message);
    });
});
