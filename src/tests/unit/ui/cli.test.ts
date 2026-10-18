import chalk, {chalkStderr} from 'chalk';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {runNetsh} from '../../../collectors/netsh.ts';
import {runSession} from '../../../ui/session.ts';
import {showNetworks} from '../../../ui/networks.ts';
import {runRecording} from '../../../ui/record.ts';

vi.mock('../../../collectors/netsh.ts', () => ({runNetsh: vi.fn()}));
vi.mock('../../../ui/session.ts', () => ({runSession: vi.fn()}));
vi.mock('../../../ui/networks.ts', () => ({showNetworks: vi.fn()}));
vi.mock('../../../ui/record.ts', () => ({runRecording: vi.fn()}));

const originalArgv = process.argv;
const originalExitCode = process.exitCode;
const originalColorLevel = chalk.level;
const originalErrorColorLevel = chalkStderr.level;
const originalInputTTY = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
const originalOutputTTY = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');

async function runCli(args: string[]) {
    process.argv = ['node', 'cli.ts', ...args];
    await import('../../../ui/cli.ts');
}

beforeEach(() => {
    vi.resetModules();
    process.exitCode = undefined;
    Object.defineProperty(process.stdin, 'isTTY', {value: true, configurable: true});
    Object.defineProperty(process.stdout, 'isTTY', {value: true, configurable: true});
    chalk.level = 0;
    chalkStderr.level = 0;
    vi.mocked(runNetsh).mockResolvedValue(0);
    vi.mocked(showNetworks).mockResolvedValue(0);
    vi.mocked(runRecording).mockResolvedValue(0);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    process.argv = originalArgv;
    process.exitCode = originalExitCode;
    chalk.level = originalColorLevel;
    chalkStderr.level = originalErrorColorLevel;
    if (originalInputTTY) {
        Object.defineProperty(process.stdin, 'isTTY', originalInputTTY);
    } else {
        Reflect.deleteProperty(process.stdin, 'isTTY');
    }
    if (originalOutputTTY) {
        Object.defineProperty(process.stdout, 'isTTY', originalOutputTTY);
    } else {
        Reflect.deleteProperty(process.stdout, 'isTTY');
    }
});

describe('CLI', () => {
    it('highlights the title when color is enabled', async () => {
        chalk.level = 1;
        await runCli(['--help']);
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('\u001b[36mWi-Fi Mapper'));
    });

    it('highlights stderr errors in red when color is enabled', async () => {
        chalkStderr.level = 1;
        await runCli(['unknown']);
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('\u001b[31mSpecify one command'));
    });

    it.each([['--help'], ['-h']])('shows help for %j', async (...args) => {
        await runCli(args);
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
        expect(console.error).not.toHaveBeenCalled();
        expect(runNetsh).not.toHaveBeenCalled();
        expect(process.exitCode).toBeUndefined();
        expect(runSession).not.toHaveBeenCalled();
    });

    it('opens an interactive session without arguments', async () => {
        await runCli([]);
        expect(runSession).toHaveBeenCalledExactlyOnceWith(expect.any(Function), 'clean');
        expect(runNetsh).not.toHaveBeenCalled();
        expect(process.exitCode).toBe(0);
    });

    it.each([['--history', 'history'], ['--clean', 'clean']])('selects the session mode with %s', async (flag, mode) => {
        await runCli([flag]);
        expect(runSession).toHaveBeenCalledExactlyOnceWith(expect.any(Function), mode);
        expect(runNetsh).not.toHaveBeenCalled();
        expect(process.exitCode).toBe(0);
    });

    it.each(['input', 'output'])('does not open the menu without a TTY for %s', async (stream) => {
        Object.defineProperty(stream === 'input' ? process.stdin : process.stdout, 'isTTY', {value: false, configurable: true});
        await runCli([]);
        expect(runSession).not.toHaveBeenCalled();
        expect(runNetsh).not.toHaveBeenCalled();
        expect(process.exitCode).toBe(2);
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('requires a terminal'));
    });

    it('executes session actions and exits successfully after a command failure', async () => {
        vi.mocked(showNetworks).mockResolvedValue(5);
        vi.mocked(runSession).mockImplementation(async (execute) => {
            expect(await execute('networks')).toBe(5);
        });
        await runCli([]);
        expect(showNetworks).toHaveBeenCalledOnce();
        expect(process.exitCode).toBe(0);
    });

    it('reports a menu startup error', async () => {
        vi.mocked(runSession).mockRejectedValue(new Error('Terminal unavailable'));
        await runCli([]);
        expect(process.exitCode).toBe(1);
        expect(console.error).toHaveBeenCalledWith('Terminal unavailable');
    });

    it.each(['drivers', 'interfaces'])('executes command %s', async (command) => {
        await runCli([command]);
        expect(runNetsh).toHaveBeenCalledExactlyOnceWith(command);
        expect(console.error).not.toHaveBeenCalled();
        expect(process.exitCode).toBe(0);
        expect(runSession).not.toHaveBeenCalled();
    });

    it('shows the network table by default', async () => {
        await runCli(['networks']);
        expect(showNetworks).toHaveBeenCalledOnce();
        expect(runNetsh).not.toHaveBeenCalled();
        expect(process.exitCode).toBe(0);
    });

    it('routes recording arguments without launching a one-shot command', async () => {
        await runCli(['record', '02:00:00:00:00:01', '--count', '1']);
        expect(runRecording).toHaveBeenCalledExactlyOnceWith(['02:00:00:00:00:01', '--count', '1']);
        expect(runNetsh).not.toHaveBeenCalled();
        expect(showNetworks).not.toHaveBeenCalled();
        expect(process.exitCode).toBe(0);
    });

    it('preserves raw network output on request', async () => {
        await runCli(['networks', '--raw']);
        expect(runNetsh).toHaveBeenCalledExactlyOnceWith('networks');
        expect(showNetworks).not.toHaveBeenCalled();
        expect(process.exitCode).toBe(0);
    });

    it('preserves a network collection failure code', async () => {
        vi.mocked(showNetworks).mockResolvedValue(5);
        await runCli(['networks']);
        expect(process.exitCode).toBe(5);
    });

    it.each([
        ['unknown'],
        ['networks', 'extra'],
        ['--help', 'extra'],
        ['networks', '&&', 'echo'],
        ['--clean', '--history'],
        ['networks', '--history'],
    ])('rejects invalid arguments %j', async (...args) => {
        await runCli(args);
        expect(process.exitCode).toBe(2);
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Specify one command'));
        expect(runNetsh).not.toHaveBeenCalled();
    });

    it('forwards the netsh error code and prints an explanation', async () => {
        vi.mocked(runNetsh).mockResolvedValue(5);
        await runCli(['drivers']);
        expect(process.exitCode).toBe(5);
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('code 5'));
    });

    it.each([
        [new Error('Access denied'), 'Access denied'],
        ['Unknown error', 'Unknown error'],
    ])('handles exception %s', async (error, message) => {
        vi.mocked(runNetsh).mockRejectedValue(error);
        await runCli(['drivers']);
        expect(process.exitCode).toBe(1);
        expect(console.error).toHaveBeenCalledWith(message);
    });
});
