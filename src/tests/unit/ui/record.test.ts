import { beforeEach, expect, it, vi } from 'vitest';
import { recordMeasurements } from '../../../services/record-measurements.ts';
import { runRecording } from '../../../ui/record.ts';

vi.mock('../../../services/record-measurements.ts', () => ({ recordMeasurements: vi.fn() }));

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(recordMeasurements).mockResolvedValue({ written: 1, errors: 0 });
});

it('rejects invalid arguments before collecting', async () => {
    expect(await runRecording(['invalid'])).toBe(2);
    expect(recordMeasurements).not.toHaveBeenCalled();
});

it('passes options and a cancellation signal to the recording service', async () => {
    expect(await runRecording(['02:00:00:00:00:01', '--count', '1'])).toBe(0);
    expect(recordMeasurements).toHaveBeenCalledWith(expect.objectContaining({ count: 1 }), expect.any(AbortSignal), expect.any(Function));
});

it('returns a nonzero code when samples contain errors', async () => {
    vi.mocked(recordMeasurements).mockResolvedValue({ written: 1, errors: 1 });
    expect(await runRecording(['02:00:00:00:00:01'])).toBe(1);
});

it('reports file failures and restores the SIGINT listener', async () => {
    const before = process.listenerCount('SIGINT');
    vi.mocked(recordMeasurements).mockRejectedValue(new Error('File already exists'));
    expect(await runRecording(['02:00:00:00:00:01'])).toBe(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('File already exists'));
    expect(process.listenerCount('SIGINT')).toBe(before);
});

it('handles Ctrl+C with exit code 130 and removes its listener', async () => {
    const before = process.listenerCount('SIGINT');
    vi.mocked(recordMeasurements).mockImplementationOnce(async (_options, signal) => {
        process.emit('SIGINT');
        expect(signal?.aborted).toBe(true);
        return { written: 1, errors: 0 };
    });
    expect(await runRecording(['02:00:00:00:00:01'])).toBe(130);
    expect(process.listenerCount('SIGINT')).toBe(before);
});
