import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { spawnMock, execFileMock, writeMock, closeMock } = vi.hoisted(() => ({ spawnMock: vi.fn(), execFileMock: vi.fn(), writeMock: vi.fn(), closeMock: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn: spawnMock, execFile: execFileMock }));
vi.mock('../../storage/measurement-writer.ts', () => ({
    openMeasurementWriter: async () => ({ write: writeMock, close: closeMock }),
}));

// Synthetic records exercise the full CLI-to-parser path without real Wi-Fi.
const output = Buffer.from(`Имя интерфейса: Test adapter
Сейчас видно следующее количество сетей: 2.
SSID 1: Example
 BSSID 1: 02:00:00:00:00:01
  Сигнал: 78%
  Тип радио: 802.11ax
  Диапазон: 2,4 ГГц
  Канал: 3
 BSSID 2: 02:00:00:00:00:02
  Сигнал: 81%
  Тип радио: 802.11ax
  Диапазон: 5 ГГц
  Канал: 44
SSID 2:
 BSSID 1: 02:00:00:00:00:03
  Сигнал: 81%
  Тип радио: 802.11ax
  Диапазон: 5 ГГц
  Канал: 44
`);
const originalArgv = process.argv;
const originalExitCode = process.exitCode;
const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;

beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    process.exitCode = undefined;
    vi.stubEnv('SystemRoot', 'C:\\TestWindows');
    vi.stubEnv('WIFI_MAPPER_ENCODING', 'utf-8');
    vi.spyOn(console, 'table').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    execFileMock.mockImplementation((_file, _args, _options, callback) => callback(null, output, Buffer.alloc(0)));
    writeMock.mockResolvedValue(undefined);
    closeMock.mockResolvedValue(undefined);
    spawnMock.mockImplementation(() => {
        const child = new EventEmitter();
        queueMicrotask(() => child.emit('close', 0, null));
        return child;
    });
});

afterEach(() => {
    process.argv = originalArgv;
    process.exitCode = originalExitCode;
    Object.defineProperty(process, 'platform', originalPlatform);
});

async function runCli(args: string[]) {
    process.argv = ['node', 'cli.ts', ...args];
    await import('../../ui/cli.ts');
}

describe('CLI network integration', () => {
    it('records a complete structured observation and original bytes through the real CLI workflow', async () => {
        await runCli(['record', '02:00:00:00:00:01', '--count', '1', '--output', 'measurements/synthetic.jsonl']);
        expect(process.exitCode).toBe(0);
        expect(writeMock).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
            schemaVersion: 1, source: 'netsh', sampleIndex: 1, targetBssid: '02:00:00:00:00:01', status: 'observed',
            observation: expect.objectContaining({ ssid: 'Example', signalQualityPercent: 78 }),
            raw: { stdoutBase64: output.toString('base64'), stderrBase64: '' },
        }));
        expect(closeMock).toHaveBeenCalledOnce();
    });

    it('collects, decodes and displays every BSSID including a hidden name', async () => {
        await runCli(['networks']);
        expect(console.table).toHaveBeenCalledExactlyOnceWith([
            { SSID: 'Example', BSSID: '02:00:00:00:00:01', Signal: '78%', Band: '2.4 GHz', Channel: 3, Radio: '802.11ax' },
            { SSID: 'Example', BSSID: '02:00:00:00:00:02', Signal: '81%', Band: '5 GHz', Channel: 44, Radio: '802.11ax' },
            { SSID: '(hidden)', BSSID: '02:00:00:00:00:03', Signal: '81%', Band: '5 GHz', Channel: 44, Radio: '802.11ax' },
        ]);
        expect(spawnMock).not.toHaveBeenCalled();
        expect(process.exitCode).toBe(0);
        expect(process.stdout.write).not.toHaveBeenCalled();
    });

    it('uses inherited streams without decoding in raw mode, even with an invalid encoding override', async () => {
        vi.stubEnv('WIFI_MAPPER_ENCODING', 'invalid-encoding');
        await runCli(['networks', '--raw']);
        expect(spawnMock).toHaveBeenCalledWith(expect.any(String), ['wlan', 'show', 'networks', 'mode=bssid'], expect.objectContaining({ stdio: 'inherit', shell: false }));
        expect(execFileMock).not.toHaveBeenCalled();
        expect(console.table).not.toHaveBeenCalled();
        expect(process.exitCode).toBe(0);
    });

    it.each([['networks'], ['networks', '--raw']])('preserves Windows failures through %j', async (...args) => {
        const windowsError = Buffer.from('Synthetic Windows error');
        execFileMock.mockImplementation((_file, _args, _options, callback) => callback({ code: 5 }, windowsError, Buffer.alloc(0)));
        spawnMock.mockImplementation(() => {
            const child = new EventEmitter();
            queueMicrotask(() => child.emit('close', 5, null));
            return child;
        });
        await runCli(args);
        expect(process.exitCode).toBe(5);
        expect(console.table).not.toHaveBeenCalled();
    });

    it('reports unrecognized output as a failure and preserves its bytes', async () => {
        const unknown = Buffer.from('Unknown output layout');
        execFileMock.mockImplementation((_file, _args, _options, callback) => callback(null, unknown, Buffer.alloc(0)));
        await runCli(['networks']);
        expect(process.exitCode).toBe(1);
        expect(process.stdout.write).toHaveBeenCalledExactlyOnceWith(unknown);
        expect(console.table).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Showing raw output'));
    });

    it('reports a process startup failure without producing a table', async () => {
        execFileMock.mockImplementation((_file, _args, _options, callback) => callback(new Error('Synthetic spawn failure'), Buffer.alloc(0), Buffer.alloc(0)));
        await runCli(['networks']);
        expect(process.exitCode).toBe(1);
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Synthetic spawn failure'));
        expect(console.table).not.toHaveBeenCalled();
    });
});
