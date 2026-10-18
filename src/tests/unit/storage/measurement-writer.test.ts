import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { openMeasurementWriter } from '../../../storage/measurement-writer.ts';
import type { Measurement } from '../../../models/measurement.ts';

let directory: string;
const sample: Measurement = { schemaVersion: 1, source: 'netsh', targetBssid: '02:00:00:00:00:01', sampleIndex: 1,
    startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:00:00.100Z', status: 'missing', observation: null,
    exitCode: 0, error: null, raw: { stdoutBase64: '', stderrBase64: '' } };

beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'wifi-mapper-test-'));
});

afterEach(async () => {
    const target = resolve(directory);
    if (!target.startsWith(resolve(tmpdir(), 'wifi-mapper-test-'))) {
        throw new Error('Unexpected test cleanup path');
    }
    await rm(target, { recursive: true, force: true });
});

it('writes independent UTF-8 JSON lines and creates the parent directory', async () => {
    const file = join(directory, 'nested', 'experiment.jsonl');
    const writer = await openMeasurementWriter(file);
    try {
        await writer.write(sample);
        await writer.write({ ...sample, sampleIndex: 2 });
    } finally {
        await writer.close();
    }
    const lines = (await readFile(file, 'utf8')).trimEnd().split('\n');
    expect(lines.map((line) => JSON.parse(line))).toEqual([sample, { ...sample, sampleIndex: 2 }]);
});

it('refuses to overwrite a previous experiment', async () => {
    const file = join(directory, 'experiment.jsonl');
    const writer = await openMeasurementWriter(file);
    await writer.write(sample);
    await writer.close();
    const before = await readFile(file);
    await expect(openMeasurementWriter(file)).rejects.toMatchObject({ code: 'EEXIST' });
    expect(await readFile(file)).toEqual(before);
});
