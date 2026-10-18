import {mkdir, open} from 'node:fs/promises';
import {dirname} from 'node:path';
import type {Measurement} from '../models/measurement.ts';

export async function openMeasurementWriter(path: string) {
    await mkdir(dirname(path), {recursive: true});
    // Never overwrite an earlier experiment.
    const file = await open(path, 'wx');
    return {
        write: async (measurement: Measurement) => {
            await file.appendFile(`${JSON.stringify(measurement)}\n`, 'utf8');
        },
        close: () => file.close(),
    };
}
