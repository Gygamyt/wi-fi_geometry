import { describe, expect, it } from 'vitest';
import { parseRecordingOptions } from '../../../services/recording-options.ts';

const bssid = '02:00:00:00:AA:01';

describe('recording options', () => {
    it('uses bounded defaults and normalizes the target BSSID', () => {
        expect(parseRecordingOptions([bssid])).toEqual({ bssid: bssid.toLowerCase(), count: 10, intervalMs: 2000, outputPath: expect.stringMatching(/^measurements[\\/].+\.jsonl$/) });
    });

    it('accepts explicit options and file paths containing spaces', () => {
        expect(parseRecordingOptions([bssid, '--count', '3', '--interval', '1000', '--output', 'measurements/first run.jsonl']))
            .toEqual({ bssid: bssid.toLowerCase(), count: 3, intervalMs: 1000, outputPath: 'measurements/first run.jsonl' });
    });

    it.each([
        [], ['invalid'], [bssid, '--unknown', '1'], [bssid, '--count'],
        [bssid, '--count', '1', '--count', '2'], [bssid, '--output', '--count'],
        [bssid, '--count', '0'], [bssid, '--count', '1001'], [bssid, '--count', '1.5'],
        [bssid, '--count', 'NaN'], [bssid, '--interval', '0'], [bssid, '--interval', '999'],
        [bssid, '--interval', '3600001'], [bssid, '--interval', '1e3'], [bssid, '--output', '\0'],
    ])('rejects invalid or ambiguous arguments %j', (...args) => {
        expect(() => parseRecordingOptions(args)).toThrow();
    });
});
