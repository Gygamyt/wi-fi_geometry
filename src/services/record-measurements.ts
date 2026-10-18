import { setTimeout as delay } from 'node:timers/promises';
import { captureNetworks } from '../collectors/netsh.ts';
import { decodeNetshOutput } from '../collectors/encoding.ts';
import { parseNetworks } from '../parsers/network-parser.ts';
import { openMeasurementWriter } from '../storage/measurement-writer.ts';
import type { Measurement } from '../models/measurement.ts';
import type { RecordingOptions } from './recording-options.ts';

export async function recordMeasurements(
    options: RecordingOptions,
    signal?: AbortSignal,
    onSample?: (sample: Measurement) => void,
): Promise<{ written: number; errors: number }> {
    const writer = await openMeasurementWriter(options.outputPath);
    let written = 0;
    let errors = 0;
    try {
        for (let index = 1; index <= options.count && !signal?.aborted; index++) {
            const sample: Measurement = {
                schemaVersion: 1, source: 'netsh', targetBssid: options.bssid, sampleIndex: index,
                startedAt: new Date().toISOString(), completedAt: '', status: 'error',
                observation: null, exitCode: null, error: null,
                raw: { stdoutBase64: '', stderrBase64: '' },
            };
            try {
                const result = await captureNetworks(signal);
                sample.exitCode = result.exitCode;
                sample.raw = {
                    stdoutBase64: result.stdout.toString('base64'),
                    stderrBase64: result.stderr.toString('base64')
                };
                if (result.exitCode !== 0) {
                    sample.error = `netsh exited with code ${result.exitCode}. See the preserved raw output.`;
                } else {
                    const observations = parseNetworks(decodeNetshOutput(result.stdout));
                    sample.observation = observations.find((network) => network.bssid === options.bssid) ?? null;
                    sample.status = sample.observation ? 'observed' : 'missing';
                }
            } catch (error) {
                if (signal?.aborted) {
                    break;
                }
                sample.error = error instanceof Error ? error.message : String(error);
            }
            if (signal?.aborted) {
                break;
            }
            sample.completedAt = new Date().toISOString();
            await writer.write(sample);
            written++;
            if (sample.status === 'error') {
                errors++;
            }
            onSample?.(sample);
            if (index < options.count && !signal?.aborted) {
                try {
                    // Sequential sampling: wait after completion; never overlap netsh calls.
                    await delay(options.intervalMs, undefined, { signal });
                } catch (error) {
                    if (!signal?.aborted) {
                        throw error;
                    }
                }
            }
        }
        return { written, errors };
    } finally {
        await writer.close();
    }
}
