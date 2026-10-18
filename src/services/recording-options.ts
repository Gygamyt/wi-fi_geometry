import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

export type RecordingOptions = {
    bssid: string;
    count: number;
    intervalMs: number;
    outputPath: string;
};

export function parseRecordingOptions(args: string[]): RecordingOptions {
    const bssid = args[0];
    if (!bssid || !/^(?:[\da-f]{2}:){5}[\da-f]{2}$/i.test(bssid)) {
        throw new Error('Usage: record <BSSID> [--count 10] [--interval 2000] [--output measurements/file.jsonl]');
    }
    const options = new Map<string, string>();
    for (let index = 1; index < args.length; index += 2) {
        const key = args[index];
        const value = args[index + 1];
        if (!key || !['--count', '--interval', '--output'].includes(key) || !value || value.startsWith('--') || options.has(key)) {
            throw new Error('Recording options require unique --count, --interval or --output flags with values.');
        }
        options.set(key, value);
    }
    const countText = options.get('--count') ?? '10';
    const intervalText = options.get('--interval') ?? '2000';
    const count = Number(countText);
    const intervalMs = Number(intervalText);
    if (!/^\d+$/.test(countText) || count < 1 || count > 1000) {
        throw new Error('--count must be an integer between 1 and 1000.');
    }
    if (!/^\d+$/.test(intervalText) || intervalMs < 1000 || intervalMs > 3_600_000) {
        throw new Error('--interval must be an integer between 1000 and 3600000 milliseconds.');
    }
    const outputPath = options.get('--output') ?? join('measurements', `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}.jsonl`);
    if (outputPath.includes('\0')) {
        throw new Error('--output must be a valid file path.');
    }
    return { bssid: bssid.toLowerCase(), count, intervalMs, outputPath };
}
