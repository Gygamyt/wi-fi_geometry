import {setTimeout as delay} from 'node:timers/promises';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {captureNetworks} from '../../../collectors/netsh.ts';
import {openMeasurementWriter} from '../../../storage/measurement-writer.ts';
import {recordMeasurements} from '../../../services/record-measurements.ts';
import type {Measurement} from '../../../models/measurement.ts';

vi.mock('../../../collectors/netsh.ts', () => ({captureNetworks: vi.fn()}));
vi.mock('../../../storage/measurement-writer.ts', () => ({openMeasurementWriter: vi.fn()}));
vi.mock('node:timers/promises', () => ({setTimeout: vi.fn()}));

const options = {bssid: '02:00:00:00:00:01', count: 3, intervalMs: 2000, outputPath: 'measurements/synthetic.jsonl'};
const raw = Buffer.from('SSID 1: Example\n BSSID 1: 02:00:00:00:00:01\n Signal: 0%');
const writer = {write: vi.fn<(sample: Measurement) => Promise<void>>(), close: vi.fn<() => Promise<void>>()};

beforeEach(() => {
    vi.stubEnv('WIFI_MAPPER_ENCODING', 'utf-8');
    writer.write.mockReset().mockResolvedValue(undefined);
    writer.close.mockReset().mockResolvedValue(undefined);
    vi.mocked(openMeasurementWriter).mockResolvedValue(writer);
    vi.mocked(captureNetworks).mockResolvedValue({exitCode: 0, stdout: raw, stderr: Buffer.alloc(0)});
    vi.mocked(delay).mockResolvedValue(undefined);
});

describe('recordMeasurements', () => {
    it('records the requested count, timestamps, zero quality and original bytes', async () => {
        const onSample = vi.fn();
        expect(await recordMeasurements(options, undefined, onSample)).toEqual({written: 3, errors: 0});
        expect(writer.write).toHaveBeenCalledTimes(3);
        const first = writer.write.mock.calls[0]?.[0];
        expect(first).toEqual(expect.objectContaining({schemaVersion: 1, source: 'netsh', targetBssid: options.bssid, sampleIndex: 1,
            status: 'observed', exitCode: 0, error: null, observation: expect.objectContaining({signalQualityPercent: 0}),
            raw: {stdoutBase64: raw.toString('base64'), stderrBase64: ''}}));
        expect(Date.parse(first!.startedAt)).not.toBeNaN();
        expect(Date.parse(first!.completedAt)).toBeGreaterThanOrEqual(Date.parse(first!.startedAt));
        expect(delay).toHaveBeenCalledTimes(2);
        expect(delay).toHaveBeenCalledWith(2000, undefined, {signal: undefined});
        expect(onSample).toHaveBeenCalledTimes(3);
        expect(writer.close).toHaveBeenCalledOnce();
    });

    it('distinguishes disappearance from zero signal and continues recording', async () => {
        vi.mocked(captureNetworks).mockResolvedValueOnce({exitCode: 0, stdout: Buffer.from('There are 0 networks currently visible.'), stderr: Buffer.alloc(0)});
        expect(await recordMeasurements(options)).toEqual({written: 3, errors: 0});
        expect(writer.write.mock.calls[0]?.[0]).toEqual(expect.objectContaining({status: 'missing', observation: null, error: null}));
        expect(writer.write.mock.calls[1]?.[0].status).toBe('observed');
    });

    it('does not substitute a different BSSID', async () => {
        vi.mocked(captureNetworks).mockResolvedValue({exitCode: 0, stdout: Buffer.from(raw.toString().replace(options.bssid, '02:00:00:00:00:02')), stderr: Buffer.alloc(0)});
        await recordMeasurements({...options, count: 1});
        expect(writer.write.mock.calls[0]?.[0].status).toBe('missing');
    });

    it('preserves failed command bytes and keeps errors separate from missing observations', async () => {
        const stderr = Buffer.from('Synthetic error');
        vi.mocked(captureNetworks).mockResolvedValueOnce({exitCode: 5, stdout: raw, stderr});
        expect(await recordMeasurements(options)).toEqual({written: 3, errors: 1});
        expect(writer.write.mock.calls[0]?.[0]).toEqual(expect.objectContaining({status: 'error', exitCode: 5, observation: null,
            raw: {stdoutBase64: raw.toString('base64'), stderrBase64: stderr.toString('base64')}}));
    });

    it.each([Buffer.from('Unrecognized output'), Buffer.from([0xff])])('records decode or parse errors with original bytes', async (stdout) => {
        vi.mocked(captureNetworks).mockResolvedValueOnce({exitCode: 0, stdout, stderr: Buffer.alloc(0)});
        expect(await recordMeasurements({...options, count: 1})).toEqual({written: 1, errors: 1});
        expect(writer.write.mock.calls[0]?.[0]).toEqual(expect.objectContaining({status: 'error', error: expect.any(String), raw: {stdoutBase64: stdout.toString('base64'), stderrBase64: ''}}));
    });

    it('records startup failures and continues to the next attempt', async () => {
        vi.mocked(captureNetworks).mockRejectedValueOnce(new Error('Synthetic process failure'));
        expect(await recordMeasurements(options)).toEqual({written: 3, errors: 1});
        expect(writer.write.mock.calls[0]?.[0]).toEqual(expect.objectContaining({status: 'error', exitCode: null, error: 'Synthetic process failure'}));
    });

    it('stops on cancellation without inventing an observation for the interrupted call', async () => {
        const controller = new AbortController();
        vi.mocked(captureNetworks).mockImplementationOnce(async () => {
            controller.abort();
            throw new Error('Aborted');
        });
        expect(await recordMeasurements(options, controller.signal)).toEqual({written: 0, errors: 0});
        expect(writer.write).not.toHaveBeenCalled();
        expect(writer.close).toHaveBeenCalledOnce();
    });

    it('stops during the interval and keeps completed samples', async () => {
        const controller = new AbortController();
        vi.mocked(delay).mockImplementationOnce(async () => {
            controller.abort();
            throw new Error('Aborted');
        });
        expect(await recordMeasurements(options, controller.signal)).toEqual({written: 1, errors: 0});
        expect(captureNetworks).toHaveBeenCalledOnce();
        expect(writer.close).toHaveBeenCalledOnce();
    });

    it('does not overlap collection calls or delay after the final sample', async () => {
        let finish!: (value: Awaited<ReturnType<typeof captureNetworks>>) => void;
        vi.mocked(captureNetworks).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
        const recording = recordMeasurements({...options, count: 1});
        await vi.waitFor(() => expect(captureNetworks).toHaveBeenCalledOnce());
        expect(writer.write).not.toHaveBeenCalled();
        expect(delay).not.toHaveBeenCalled();
        finish({exitCode: 0, stdout: raw, stderr: Buffer.alloc(0)});
        await recording;
        expect(delay).not.toHaveBeenCalled();
    });

    it('closes the file and stops if writing fails', async () => {
        writer.write.mockRejectedValueOnce(new Error('Disk full'));
        await expect(recordMeasurements(options)).rejects.toThrow('Disk full');
        expect(captureNetworks).toHaveBeenCalledOnce();
        expect(writer.close).toHaveBeenCalledOnce();
    });
});
