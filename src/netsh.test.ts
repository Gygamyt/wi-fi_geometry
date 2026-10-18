import {EventEmitter} from 'node:events';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {runNetsh} from './netsh.ts';

const {spawnMock} = vi.hoisted(() => ({spawnMock: vi.fn()}));

vi.mock('node:child_process', () => ({spawn: spawnMock}));

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;
let child: EventEmitter;

beforeEach(() => {
    Object.defineProperty(process, 'platform', {value: 'win32', configurable: true});
    vi.stubEnv('SystemRoot', 'C:\\TestWindows');
    child = new EventEmitter();
    spawnMock.mockReturnValue(child);
});

afterEach(() => {
    Object.defineProperty(process, 'platform', originalPlatform);
});

describe('runNetsh', () => {
    it.each([
        ['drivers', ['wlan', 'show', 'drivers']],
        ['interfaces', ['wlan', 'show', 'interfaces']],
        ['networks', ['wlan', 'show', 'networks', 'mode=bssid']],
    ] as const)('runs %s directly with inherited output streams', async (command, args) => {
        const result = runNetsh(command);

        expect(spawnMock).toHaveBeenCalledExactlyOnceWith(
            join('C:\\TestWindows', 'System32', 'netsh.exe'),
            args,
            {stdio: 'inherit', shell: false, windowsHide: true, timeout: 30_000},
        );

        child.emit('close', 0, null);
        await expect(result).resolves.toBe(0);
    });

    it.each([0, 1, 5])('forwards exit code %s', async (code) => {
        const result = runNetsh('networks');
        child.emit('close', code, null);
        await expect(result).resolves.toBe(code);
    });

    it('treats a missing exit code as a failure', async () => {
        const result = runNetsh('networks');
        child.emit('close', null, null);
        await expect(result).resolves.toBe(1);
    });

    it('propagates a process startup error', async () => {
        const error = new Error('spawn ENOENT');
        const result = runNetsh('networks');
        child.emit('error', error);
        child.emit('close', -1, null);
        await expect(result).rejects.toBe(error);
    });

    it('propagates a synchronous spawn error', async () => {
        const error = new Error('Could not create process');
        spawnMock.mockImplementation(() => { throw error; });
        await expect(runNetsh('networks')).rejects.toBe(error);
    });

    it('reports process termination, including a timeout', async () => {
        const result = runNetsh('networks');
        child.emit('close', null, 'SIGTERM');
        await expect(result).rejects.toThrow('netsh interrupted (SIGTERM)');
    });

    it('rejects non-Windows execution before calling the OS', () => {
        Object.defineProperty(process, 'platform', {value: 'linux', configurable: true});
        expect(() => runNetsh('networks')).toThrow('requires Windows');
        expect(spawnMock).not.toHaveBeenCalled();
    });

    it('rejects execution without the Windows path', () => {
        vi.stubEnv('SystemRoot', undefined);
        expect(() => runNetsh('networks')).toThrow('SystemRoot');
        expect(spawnMock).not.toHaveBeenCalled();
    });
});
