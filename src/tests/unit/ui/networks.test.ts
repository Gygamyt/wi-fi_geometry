import {beforeEach, describe, expect, it, vi} from 'vitest';
import {captureNetworks} from '../../../collectors/netsh.ts';
import {showNetworks} from '../../../ui/networks.ts';

vi.mock('../../../collectors/netsh.ts', () => ({captureNetworks: vi.fn()}));

const example = 'SSID 1: Example\n BSSID 1: 02:00:00:00:00:01\n Signal: 0%\n Band: 5 GHz\n Channel: 44';

beforeEach(() => {
    vi.stubEnv('WIFI_MAPPER_ENCODING', 'utf-8');
    vi.spyOn(console, 'table').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    vi.mocked(captureNetworks).mockResolvedValue({exitCode: 0, stdout: Buffer.from(example), stderr: Buffer.alloc(0)});
});

describe('showNetworks', () => {
    it('renders a table with units and explicit unknown fields', async () => {
        expect(await showNetworks()).toBe(0);
        expect(console.table).toHaveBeenCalledExactlyOnceWith([
            {SSID: 'Example', BSSID: '02:00:00:00:00:01', Signal: '0%', Band: '5 GHz', Channel: 44, Radio: '—'},
        ]);
    });

    it('labels empty names as hidden without changing the parser representation', async () => {
        vi.mocked(captureNetworks).mockResolvedValue({exitCode: 0, stdout: Buffer.from(example.replace('Example', '')), stderr: Buffer.alloc(0)});
        await showNetworks();
        expect(console.table).toHaveBeenCalledWith([expect.objectContaining({SSID: '(hidden)'})]);
    });

    it('neutralizes terminal controls in network names', async () => {
        vi.mocked(captureNetworks).mockResolvedValue({exitCode: 0, stdout: Buffer.from(example.replace('Example', '\u001b[31mExample\u0007')), stderr: Buffer.alloc(0)});
        await showNetworks();
        expect(console.table).toHaveBeenCalledWith([expect.objectContaining({SSID: '(non-printable)'})]);
    });

    it('distinguishes an empty scan from a parsing failure', async () => {
        vi.mocked(captureNetworks).mockResolvedValue({exitCode: 0, stdout: Buffer.from('There are 0 networks currently visible.'), stderr: Buffer.alloc(0)});
        expect(await showNetworks()).toBe(0);
        expect(console.log).toHaveBeenCalledWith('No networks are currently visible.');
        expect(console.table).not.toHaveBeenCalled();
    });

    it.each([Buffer.from('Unrecognized output'), Buffer.from([0xff])])('falls back to raw output on parse or decode failure', async (stdout) => {
        vi.mocked(captureNetworks).mockResolvedValue({exitCode: 0, stdout, stderr: Buffer.alloc(0)});
        expect(await showNetworks()).toBe(1);
        expect(process.stdout.write).toHaveBeenCalledWith(stdout);
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Showing raw output'));
        expect(console.table).not.toHaveBeenCalled();
    });

    it('preserves Windows errors and their exit code without parsing', async () => {
        const stdout = Buffer.from('Windows error');
        const stderr = Buffer.from('Permission denied');
        vi.mocked(captureNetworks).mockResolvedValue({exitCode: 5, stdout, stderr});
        expect(await showNetworks()).toBe(5);
        expect(process.stdout.write).toHaveBeenCalledWith(stdout);
        expect(process.stderr.write).toHaveBeenCalledWith(stderr);
        expect(console.table).not.toHaveBeenCalled();
    });

    it('preserves stderr even when the command succeeds', async () => {
        const stderr = Buffer.from('Diagnostic message');
        vi.mocked(captureNetworks).mockResolvedValue({exitCode: 0, stdout: Buffer.from(example), stderr});
        expect(await showNetworks()).toBe(0);
        expect(process.stderr.write).toHaveBeenCalledWith(stderr);
    });
});
